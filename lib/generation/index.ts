import { hasLlmKey } from "../llm";
import type { Cefr, ExamDifficulty, TestFormPayload } from "../types";
import { makeAcademicSet, makeCtwSet, makeDailySets } from "./bank-reading";
import { listeningBundleFor } from "./bank-listening";
import { makeSpeakingBundle } from "./bank-speaking";
import { makeWritingBundle } from "./bank-writing";
import { getDifficultyProfile, parseDifficulty } from "./difficulty";
import { appendGrownBank, loadGrownBank } from "./grown-bank";
import { isSeenText } from "./content-key";
import { seenForUser } from "./history";
import { createFreshItems } from "./llm-create";
import { enrichWithLlm } from "./llm-enrich";
import { isNeedMoreItems, NeedMoreItems } from "./need-more";
import { reusedSeenKeys } from "./uniqueness";
import { emptyGrownBank, type GrownBank } from "./seeds";
import { validateForm } from "./validate";

export type GenerateProgress = (update: { progress: number; stage: string }) => void;

function asCtw(cefr: Cefr): "B1" | "B2" | "C1" {
  if (cefr === "C1" || cefr === "C2") return "C1";
  if (cefr === "B2") return "B2";
  return "B1";
}

export function assembleLocalForm(
  difficulty: ExamDifficulty = "standard",
  extras: GrownBank = emptyGrownBank(),
  seen: Set<string> = new Set(),
  strict = false,
): TestFormPayload {
  const d = getDifficultyProfile(difficulty);
  const ctwExclude: string[] = [];
  const ctw1a = makeCtwSet("m1", asCtw(d.reading.m1Ctw[0]), ctwExclude, extras.ctw, seen, strict);
  ctwExclude.push(ctw1a.fullPassage);
  const ctw1b = makeCtwSet("m1", asCtw(d.reading.m1Ctw[1]), ctwExclude, extras.ctw, seen, strict);
  ctwExclude.push(ctw1b.fullPassage);
  const dailyUsed = new Set<string>();
  const academicUsed = new Set<string>();
  const listenUsed = { scripts: new Set<string>(), titles: new Set<string>() };
  const ctw2l = makeCtwSet("m2", asCtw(d.reading.m2LowerCtw), ctwExclude, extras.ctw, seen, strict);
  ctwExclude.push(ctw2l.fullPassage);
  const ctw2u = makeCtwSet("m2", asCtw(d.reading.m2UpperCtw), ctwExclude, extras.ctw, seen, strict);
  const form: TestFormPayload = {
    topics: [],
    difficulty,
    reading: {
      module1: {
        completeTheWords: [ctw1a, ctw1b],
        dailyLife: makeDailySets("m1", [2, 2, 3, 3], d.reading.daily, extras.daily, dailyUsed, seen, strict),
        academic: [makeAcademicSet("m1", d.reading.academic, extras.academic, academicUsed, seen, strict)],
      },
      module2Lower: {
        completeTheWords: [ctw2l],
        dailyLife: makeDailySets(
          "m2",
          [2, 3],
          d.reading.daily === "harder" ? "easier" : d.reading.daily,
          extras.daily,
          dailyUsed,
          seen,
          strict,
        ),
        academic: [],
      },
      module2Upper: {
        completeTheWords: [ctw2u],
        dailyLife: makeDailySets(
          "m2",
          [2, 3],
          d.reading.daily === "easier" ? "standard" : d.reading.daily,
          extras.daily,
          dailyUsed,
          seen,
          strict,
        ),
        academic: [],
      },
    },
    listening: {
      module1: listeningBundleFor(
        "m1",
        { choose: 16, conversations: 4, announcements: 2, talks: 1 },
        { band: d.listening.m1, extras, used: listenUsed, seen, strict },
      ),
      module2Lower: listeningBundleFor(
        "m2",
        { choose: 5, conversations: 2, announcements: 1, talks: 1 },
        {
          band: d.listening.m2Lower,
          extras,
          used: listenUsed,
          seen,
          strict,
        },
      ),
      module2Upper: listeningBundleFor(
        "m2",
        { choose: 5, conversations: 2, announcements: 1, talks: 1 },
        {
          band: d.listening.m2Upper,
          extras,
          used: listenUsed,
          seen,
          strict,
        },
      ),
    },
    writing: makeWritingBundle(d.writing, extras.sentences, seen, strict),
    speaking: makeSpeakingBundle({ repeats: extras.repeats, interviews: extras.interviews }, seen, strict),
  };
  form.topics = collectTopics(form);
  return form;
}

function collectTopics(form: TestFormPayload): string[] {
  const tags = new Set<string>();
  for (const bundle of [form.reading.module1, form.reading.module2Lower, form.reading.module2Upper]) {
    for (const set of bundle.completeTheWords) tags.add(set.topic);
    for (const set of bundle.dailyLife) tags.add(set.topic);
    for (const set of bundle.academic) tags.add(set.topic);
  }
  for (const bundle of [form.listening.module1, form.listening.module2Lower, form.listening.module2Upper]) {
    for (const set of [...bundle.conversations, ...bundle.announcements, ...bundle.talks]) {
      tags.add(set.topic);
    }
  }
  return [...tags];
}

export async function generateFormPayload(
  difficulty: ExamDifficulty = "standard",
  userId?: string,
  onProgress?: GenerateProgress,
): Promise<TestFormPayload> {
  const level = parseDifficulty(difficulty);
  const report = (progress: number, stage: string) => onProgress?.({ progress, stage });
  report(4, "Loading what you have already seen");
  const history = userId ? await seenForUser(userId) : { keys: new Set<string>(), labels: [] as string[] };
  let extras = loadGrownBank();
  let form: TestFormPayload | null = null;
  let emptyRounds = 0;
  const avoid = [...history.labels, ...[...history.keys].slice(-40)];

  if (hasLlmKey()) {
    report(8, "Writing a new batch of original items");
    const seedForm = assembleLocalForm(level, extras);
    const created = await createFreshItems(level, seedForm, avoid, {
      scale: 1,
      onBatch: (label) => report(12, `Writing original ${label}`),
    });
    if (created.added > 0) extras = appendGrownBank(created.bank);
  }

  for (let round = 0; round < 100; round += 1) {
    report(Math.min(68, 16 + round * 5), round === 0 ? "Building an unused paper" : `Writing more original items (round ${round + 1})`);
    try {
      form = validLocalForm(level, extras, history.keys, true);
      break;
    } catch (err) {
      if (!isNeedMoreItems(err) && !(err instanceof Error && /items|module|must have/i.test(err.message))) {
        throw err;
      }
      if (!hasLlmKey()) {
        throw new Error(
          "A fully new paper needs unused items. Add GEMINI_API_KEY or OPENAI_API_KEY so the app can keep writing original questions instead of repeating old ones.",
        );
      }
      const created = await createFreshItems(level, form || assembleLocalForm(level, extras), avoid, {
        scale: 2,
        onBatch: (label) =>
          report(Math.min(68, 18 + round * 5), `Writing original ${label} (round ${round + 1})`),
      });
      if (created.added > 0) {
        extras = appendGrownBank(created.bank);
        emptyRounds = 0;
      } else {
        emptyRounds += 1;
        if (emptyRounds >= 12) {
          throw new Error(
            "The model could not produce enough unused items. Check the API key and Gemini fallback order, then try again.",
          );
        }
      }
    }
  }
  if (!form) {
    throw new Error("Could not assemble an all-new paper. Try again in a few minutes.");
  }

  report(70, "Writing a new email and discussion");
  await enrichUntilUnseen(form, level, avoid, history.keys);

  const finalErrors = validateForm(form);
  if (finalErrors.length) {
    throw new Error(`The paper failed uniqueness or count checks: ${finalErrors.join("; ")}`);
  }
  const reused = reusedSeenKeys(form, history.keys);
  if (reused.length) {
    throw new Error("Assembly still contained a previously seen item. The paper was not saved.");
  }
  report(74, "Paper is all new");
  return form;
}

async function enrichUntilUnseen(
  form: TestFormPayload,
  level: ExamDifficulty,
  avoid: string[],
  seen: Set<string>,
) {
  const keepEmail = { ...form.writing.email };
  const keepDiscussion = {
    ...form.writing.discussion,
    professor: { ...form.writing.discussion.professor },
    students: form.writing.discussion.students.map((row) => ({ ...row })),
  };
  if (!hasLlmKey()) return;
  for (let i = 0; i < 8; i += 1) {
    try {
      await enrichWithLlm(form, level, avoid);
    } catch {
      Object.assign(form.writing.email, keepEmail);
      form.writing.discussion.course = keepDiscussion.course;
      form.writing.discussion.professor = keepDiscussion.professor;
      form.writing.discussion.students = keepDiscussion.students;
      form.writing.discussion.prompt = keepDiscussion.prompt;
      return;
    }
    const emailSeen = isSeenText(seen, form.writing.email.scenario || "");
    const discussionSeen = isSeenText(seen, form.writing.discussion.prompt || "");
    if (!emailSeen && !discussionSeen) return;
    if (emailSeen) Object.assign(form.writing.email, keepEmail);
    if (discussionSeen) {
      form.writing.discussion.course = keepDiscussion.course;
      form.writing.discussion.professor = keepDiscussion.professor;
      form.writing.discussion.students = keepDiscussion.students;
      form.writing.discussion.prompt = keepDiscussion.prompt;
    }
    avoid = [
      ...avoid,
      form.writing.email.scenario.slice(0, 80),
      form.writing.discussion.course,
      form.writing.discussion.prompt.slice(0, 80),
    ];
  }
}

function validLocalForm(
  difficulty: ExamDifficulty,
  extras: GrownBank,
  seen: Set<string> = new Set(),
  strict = false,
): TestFormPayload {
  const form = assembleLocalForm(difficulty, extras, seen, strict);
  const errors = validateForm(form);
  if (errors.length) {
    if (strict) throw new NeedMoreItems("valid-paper");
    const retry = assembleLocalForm(difficulty, extras, seen, strict);
    const retryErrors = validateForm(retry);
    if (retryErrors.length) throw new Error(retryErrors.join("; "));
    return retry;
  }
  if (reusedSeenKeys(form, seen).length) throw new NeedMoreItems("uniqueness");
  return form;
}

export { validateForm };
