import path from "path";
import { scoreListeningModule, scoreReadingModule } from "./adaptive";
import { prisma } from "./db";
import { parseForm } from "./form";
import { generateJson, hasLlmKey } from "./llm";
import {
  buildBands,
  cefrFromBand,
  classic30Scores,
  comparable120,
  CONVERSION_NOTES,
  LISTENING_RAW_MAX,
  matchSentence,
  overallBand,
  READING_RAW_MAX,
  repeatScoreFromWer,
  scaleAdaptive,
  wordErrorRate,
} from "./scoring";
import {
  analyzeDiscussionFormat,
  analyzeEmailFormat,
  sampleDiscussionAnswer,
  chooseEmailSample,
} from "./writing-feedback";
import { enabledSections, parseScope, sectionEnabled, taskEnabled } from "./scope";
import { transcribeFile } from "./stt";
import type { RawScores, RouteLevel } from "./types";

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function answerMap(rows: Array<{ itemId: string; valueJson: string }>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.itemId] = parseValue(row.valueJson);
  return out;
}

function heuristicEmailScore(text: string, goal: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) return text.trim() ? 1 : 0;
  let score = 2;
  if (words.length >= 40) score += 1;
  if (words.length >= 80) score += 1;
  const lower = text.toLowerCase();
  if (/(dear|hello|hi|sincerely|regards|thank)/.test(lower)) score += 1;
  if (goal.split(/\s+/).some((w) => w.length > 4 && lower.includes(w.toLowerCase()))) {
    score = Math.min(5, score + 1);
  }
  const issues = analyzeEmailFormat(text);
  if (issues.length >= 2) score = Math.max(0, score - 1);
  if (issues.length >= 4) score = Math.max(0, score - 1);
  return Math.min(5, score);
}

function heuristicDiscussionScore(text: string, prompt: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!text.trim()) return 0;
  let score = 1;
  if (words.length < 20) score = 1;
  else if (words.length < 40) score = 2;
  else if (words.length < 80) score = 3;
  else if (words.length < 130) score = 4;
  else score = 5;
  const issues = analyzeDiscussionFormat(text, prompt);
  if (issues.length >= 2) score = Math.max(0, score - 1);
  return score;
}

function writingReason(score: number, max: number, improve: string, issues: string[]) {
  const format = issues.length
    ? ` Format issues lowered the result: ${issues.join(" ")}`
    : " Format checks (greeting/closing, length, punctuation, originality) were acceptable.";
  return `This response scored ${score} of ${max}. ${improve}${format}`;
}

function heuristicInterviewScore(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!text.trim()) return 0;
  if (words.length < 12) return 1;
  if (words.length < 30) return 2;
  if (words.length < 55) return 3;
  if (words.length < 90) return 4;
  return 5;
}

async function llmScore(kind: string, prompt: string, response: string) {
  try {
    const data = (await generateJson({
      system:
        "Score a TOEFL constructed response. Return JSON with score (0-5 integer), traits (object), evidence (string[]), how_to_improve (string).",
      user: `Task type: ${kind}\nPrompt:\n${prompt}\n\nResponse:\n${response}`,
      temperature: 0.2,
    })) as { score?: number; traits?: unknown; evidence?: string[]; how_to_improve?: string };
    return {
      score: Math.max(0, Math.min(5, Math.round(Number(data.score) || 0))),
      traits: data.traits || {},
      evidence: data.evidence || [],
      how_to_improve: data.how_to_improve || "",
    };
  } catch {
    return {
      score: 0,
      traits: { error: "LLM scoring failed" },
      evidence: [],
      how_to_improve: "",
    };
  }
}

export async function scoreSession(sessionId: string) {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { form: true, responses: true },
  });
  if (!session) throw new Error("Session not found");
  const form = parseForm(session.form.payloadJson);
  const scope = parseScope(session.scopeJson);
  const answers = answerMap(session.responses);
  const raw: RawScores = {};
  const traits: Record<string, unknown> = {};
  const itemResults: Record<string, unknown> = {};

  if (sectionEnabled(scope, "reading")) {
    const m1 = scoreReadingModule(form, "m1", scope, answers);
    const route = (session.readingRoute as RouteLevel) || "lower";
    const m2 = scoreReadingModule(form, route, scope, answers);
    raw.reading = {
      correct: m1.correct + m2.correct,
      possible: m1.possible + m2.possible,
      scaled: scaleAdaptive(m1.correct, m1.possible, m2.correct, m2.possible, route, READING_RAW_MAX),
      route,
    };
  }

  if (sectionEnabled(scope, "listening")) {
    const m1 = scoreListeningModule(form, "m1", scope, answers);
    const route = (session.listeningRoute as RouteLevel) || "lower";
    const m2 = scoreListeningModule(form, route, scope, answers);
    raw.listening = {
      correct: m1.correct + m2.correct,
      possible: m1.possible + m2.possible,
      scaled: scaleAdaptive(m1.correct, m1.possible, m2.correct, m2.possible, route, LISTENING_RAW_MAX),
      route,
    };
  }

  if (sectionEnabled(scope, "writing")) {
    let sentence = 0;
    if (taskEnabled(scope, "writing", "build_sentence")) {
      for (const item of form.writing.sentences) {
        const given = Array.isArray(answers[item.id]) ? (answers[item.id] as string[]) : [];
        const ok = matchSentence(given, item.answer, item.alternates);
        if (ok) sentence += 1;
        itemResults[item.id] = { correct: ok, key: item.answer, rationale: item.rationale };
      }
    }
    let email = 0;
    let discussion = 0;
    if (taskEnabled(scope, "writing", "write_email")) {
      const text = String(answers[form.writing.email.id] ?? "");
      const formatIssues = analyzeEmailFormat(text);
      const sampleAnswer = chooseEmailSample(form.writing.email, form.writing.email.sampleAnswer);
      const ai =
        hasLlmKey() && text.trim()
          ? await llmScore("write_email", `${form.writing.email.scenario}\nGoal: ${form.writing.email.goal}`, text)
          : {
              score: heuristicEmailScore(text, form.writing.email.goal),
              traits: { method: "heuristic" },
              evidence: [],
              how_to_improve: "Add a greeting, a clear request, and a polite closing.",
            };
      if (formatIssues.length >= 3) ai.score = Math.max(0, ai.score - 1);
      email = ai.score;
      traits.email = {
        ...ai,
        formatIssues,
        sampleAnswer,
        reason: writingReason(ai.score, 5, ai.how_to_improve, formatIssues),
      };
    }
    if (taskEnabled(scope, "writing", "write_discussion")) {
      const text = String(answers[form.writing.discussion.id] ?? "");
      const prompt = `${form.writing.discussion.professor.text}\n${form.writing.discussion.prompt}`;
      const formatIssues = analyzeDiscussionFormat(text, prompt);
      const sampleAnswer = sampleDiscussionAnswer(form.writing.discussion);
      const ai =
        hasLlmKey() && text.trim()
          ? await llmScore("write_discussion", prompt, text)
          : {
              score: heuristicDiscussionScore(text, prompt),
              traits: { method: "heuristic" },
              evidence: [],
              how_to_improve: "Take a clear position and support it with reasons and an example.",
            };
      if (formatIssues.length >= 3) ai.score = Math.max(0, ai.score - 1);
      discussion = ai.score;
      traits.discussion = {
        ...ai,
        formatIssues,
        sampleAnswer,
        reason: writingReason(ai.score, 5, ai.how_to_improve, formatIssues),
      };
    }
    raw.writing = { sentence, email, discussion, total: sentence + email + discussion };
  }

  if (sectionEnabled(scope, "speaking")) {
    let repeat = 0;
    if (taskEnabled(scope, "speaking", "listen_repeat")) {
      for (const item of form.speaking.listenRepeat.items) {
        const rec = session.responses.find((r) => r.itemId === item.id);
        let transcript = rec?.transcript || "";
        if (!transcript && rec?.recordingPath) {
          transcript = await transcribeFile(path.join(process.cwd(), rec.recordingPath));
          if (transcript) {
            await prisma.response.update({ where: { id: rec.id }, data: { transcript } });
          }
        }
        const value = answers[item.id];
        if (!transcript && value && typeof value === "object" && value && "transcript" in value) {
          transcript = String((value as { transcript?: string }).transcript || "");
        }
        const wer = wordErrorRate(item.sentence, transcript);
        const score = repeatScoreFromWer(wer, Boolean(transcript.trim() || rec?.recordingPath));
        repeat += score;
        itemResults[item.id] = { score, wer, transcript, key: item.sentence };
      }
    }
    let interview = 0;
    if (taskEnabled(scope, "speaking", "take_interview")) {
      for (const item of form.speaking.interview.items) {
        const rec = session.responses.find((r) => r.itemId === item.id);
        let transcript = rec?.transcript || "";
        if (!transcript && rec?.recordingPath) {
          transcript = await transcribeFile(path.join(process.cwd(), rec.recordingPath));
          if (transcript) {
            await prisma.response.update({ where: { id: rec.id }, data: { transcript } });
          }
        }
        const value = answers[item.id];
        if (!transcript && value && typeof value === "object" && "transcript" in (value as object)) {
          transcript = String((value as { transcript?: string }).transcript || "");
        }
        const ai =
          hasLlmKey() && transcript.trim()
            ? await llmScore("take_interview", item.prompt, transcript)
            : {
                score: heuristicInterviewScore(transcript),
                traits: { method: "heuristic-or-transcript" },
                evidence: [],
                how_to_improve: "Answer the question directly and add a reason plus a short example.",
              };
        interview += ai.score;
        itemResults[item.id] = { ...ai, transcript };
      }
    }
    raw.speaking = { repeat, interview, total: repeat + interview };
  }

  const present = enabledSections(scope);
  const bands = buildBands(raw, present);
  let compositeFrom: string | null = null;
  if (session.sourceSessionId && session.mode === "redo") {
    const source = await prisma.scoreReport.findUnique({ where: { sessionId: session.sourceSessionId } });
    if (source) {
      const sourceBands = JSON.parse(source.bandsJson) as {
        reading?: number;
        listening?: number;
        writing?: number;
        speaking?: number;
      };
      bands.projectedOverall = overallBand([
        bands.reading ?? sourceBands.reading,
        bands.listening ?? sourceBands.listening,
        bands.writing ?? sourceBands.writing,
        bands.speaking ?? sourceBands.speaking,
      ]);
      compositeFrom = session.sourceSessionId;
    }
  }

  const concordance = {
    overall120: bands.overall != null ? comparable120(bands.overall) : null,
    projected120: bands.projectedOverall != null ? comparable120(bands.projectedOverall) : null,
    classic30: classic30Scores(raw),
    cefr: {
      reading: bands.reading != null ? cefrFromBand(bands.reading) : null,
      listening: bands.listening != null ? cefrFromBand(bands.listening) : null,
      writing: bands.writing != null ? cefrFromBand(bands.writing) : null,
      speaking: bands.speaking != null ? cefrFromBand(bands.speaking) : null,
      overall: bands.overall != null ? cefrFromBand(bands.overall) : null,
    },
    notes: CONVERSION_NOTES,
  };

  const payload = {
    rawJson: JSON.stringify(raw),
    bandsJson: JSON.stringify(bands),
    traitsJson: JSON.stringify({ traits, itemResults }),
    concordanceJson: JSON.stringify(concordance),
    compositeFromSessionId: compositeFrom,
  };

  await prisma.scoreReport.upsert({
    where: { sessionId },
    create: { sessionId, ...payload },
    update: payload,
  });
  await prisma.examSession.update({
    where: { id: sessionId },
    data: { status: "completed", currentPointer: "completed", completedAt: new Date() },
  });
  return { raw, bands, concordance, traits, itemResults };
}
