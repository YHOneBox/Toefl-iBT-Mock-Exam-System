import { throwIfAborted } from "../abort";
import type { GeminiWaitInfo } from "../gemini-limiter";
import { hasLlmKey } from "../llm";
import type { Cefr, ExamDifficulty, TestFormPayload } from "../types";
import { makeAcademicSet, makeCtwSet, makeDailySets } from "./bank-reading";
import { listeningBundleFor } from "./bank-listening";
import { makeSpeakingBundle } from "./bank-speaking";
import { makeWritingBundle } from "./bank-writing";
import { getDifficultyProfile, parseDifficulty } from "./difficulty";
import { appendGrownBank, loadGrownBank } from "./grown-bank";
import { contentKey, isSeenText } from "./content-key";
import { seenForUser } from "./history";
import { createFreshItems } from "./llm-create";
import { enrichWithLlm } from "./llm-enrich";
import { isNeedMoreItems, NeedMoreItems } from "./need-more";
import { formUniquenessErrors, reusedSeenKeys } from "./uniqueness";
import { emptyGrownBank, type GrownBank } from "./seeds";
import { validateForm } from "./validate";

export type GenerateProgress = (update: { progress: number; stage: string; detail?: string }) => void;

const MAX_ASSEMBLE_ROUNDS = 8;
const MAX_EMPTY_FOR_KIND = 4;

function kindFromAssembleErrors(errors: string[]): string {
  const blob = errors.join(" ").toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/listen-choose|listen and choose/, "choose"],
    [/conversation/, "conversations"],
    [/announcement/, "announcements"],
    [/academic talk|\btalks?\b/, "talks"],
    [/complete the words|\bctw\b/, "ctw"],
    [/daily/, "daily"],
    [/academic/, "academic"],
    [/sentence/, "sentences"],
    [/email/, "email"],
    [/discussion/, "discussion"],
    [/repeat/, "repeats"],
    [/interview/, "interviews"],
    [/reuse|seen|duplicate question|fingerprint/, "uniqueness"],
  ];
  for (const [re, kind] of rules) {
    if (re.test(blob)) return kind;
  }
  return "valid-paper";
}

function missingLabel(kind: string) {
  const labels: Record<string, string> = {
    sentences: "build-a-sentence items",
    email: "email prompts",
    discussion: "academic discussion prompts",
    repeats: "listen-and-repeat sets",
    interviews: "interview sets",
    ctw: "complete-the-words passages",
    daily: "daily-life texts",
    academic: "academic passages",
    choose: "listen-and-choose items",
    conversations: "conversations",
    announcements: "announcements",
    talks: "academic talks",
    uniqueness: "unused items that do not repeat",
    "valid-paper": "a complete unused paper",
  };
  return labels[kind] || kind;
}

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
  const usedStems = new Set<string>();
  const listenUsed = { scripts: new Set<string>(), titles: new Set<string>(), stems: usedStems };
  const ctw2l = makeCtwSet("m2", asCtw(d.reading.m2LowerCtw), ctwExclude, extras.ctw, seen, strict);
  ctwExclude.push(ctw2l.fullPassage);
  const ctw2u = makeCtwSet("m2", asCtw(d.reading.m2UpperCtw), ctwExclude, extras.ctw, seen, strict);
  const reading = {
    module1: {
      completeTheWords: [ctw1a, ctw1b],
      dailyLife: makeDailySets("m1", [2, 2, 3, 3], d.reading.daily, extras.daily, dailyUsed, seen, strict, usedStems),
      academic: [makeAcademicSet("m1", d.reading.academic, extras.academic, academicUsed, seen, strict, usedStems)],
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
        usedStems,
      ),
      academic: [] as ReturnType<typeof makeAcademicSet>[],
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
        usedStems,
      ),
      academic: [] as ReturnType<typeof makeAcademicSet>[],
    },
  };
  for (const value of [...dailyUsed, ...academicUsed, ...ctwExclude]) {
    const key = contentKey(value);
    if (key) listenUsed.scripts.add(key);
  }
  const form: TestFormPayload = {
    topics: [],
    difficulty,
    reading,
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
    writing: makeWritingBundle(d.writing, extras, seen, strict, usedStems),
    speaking: makeSpeakingBundle({ repeats: extras.repeats, interviews: extras.interviews }, seen, strict, usedStems),
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
  opts?: { signal?: AbortSignal },
): Promise<TestFormPayload> {
  const level = parseDifficulty(difficulty);
  const signal = opts?.signal;
  let lastProgress = 4;
  const report = (progress: number, stage: string, detail?: string) => {
    throwIfAborted(signal);
    lastProgress = Math.max(lastProgress, Math.min(99, progress));
    onProgress?.({ progress: lastProgress, stage, detail });
  };
  report(4, "Loading what you have already seen", "Checking past papers so this sitting does not repeat a question");
  const history = userId ? await seenForUser(userId) : { keys: new Set<string>(), labels: [] as string[] };
  let extras = loadGrownBank();
  let form: TestFormPayload | null = null;
  const emptyByKind: Record<string, number> = {};
  const avoid = [...history.labels, ...[...history.keys].slice(-40)];

  const onWait = (info: GeminiWaitInfo) => {
    report(
      lastProgress,
      info.waitMs > 200 ? "Pacing Gemini requests" : "Using your Gemini model order",
      info.reason,
    );
  };

  report(8, "Using unused items already on hand", "Calling the model only if a unique paper cannot be built yet");
  let missingKind = "";
  let neededLlm = false;
  try {
    form = validLocalForm(level, extras, history.keys, true);
  } catch (err) {
    if (!isNeedMoreItems(err) && !(err instanceof Error && /items|module|must have/i.test(err.message))) {
      throw err;
    }
    missingKind = isNeedMoreItems(err) ? err.kind : "valid-paper";
  }

  for (let round = 0; !form && round < MAX_ASSEMBLE_ROUNDS; round += 1) {
    throwIfAborted(signal);
    const kind = missingKind || "valid-paper";
    if (!hasLlmKey()) {
      throw new Error(
        `Need more unused ${missingLabel(kind)}. Add GEMINI_API_KEY (and optionally GEMINI_API_KEY_FALLBACK) or OPENAI_API_KEY so the app can write original questions instead of repeating old ones.`,
      );
    }
    report(
      Math.min(68, 16 + round * 7),
      `Writing more ${missingLabel(kind)}`,
      `One Gemini request at a time · round ${round + 1} of ${MAX_ASSEMBLE_ROUNDS}`,
    );
    neededLlm = true;
    const created = await createFreshItems(level, assembleLocalForm(level, extras), avoid, {
      scale: round === 0 ? 1 : 2,
      focus: kind,
      round,
      signal,
      seen: history.keys,
      userId,
      onWait,
      onBatch: (label) =>
        report(
          Math.min(68, 18 + round * 7),
          `Writing original ${label}`,
          "Using the Gemini fallback order saved for this account",
        ),
    });
    if (created.added > 0) {
      extras = appendGrownBank(created.bank);
      emptyByKind[kind] = 0;
    } else {
      emptyByKind[kind] = (emptyByKind[kind] || 0) + 1;
      if (emptyByKind[kind] >= MAX_EMPTY_FOR_KIND) {
        throw new Error(
          `The model could not produce enough unused ${missingLabel(kind)} after ${MAX_EMPTY_FOR_KIND} tries. Check the API key and Gemini fallback order, then try again.`,
        );
      }
    }
    try {
      form = validLocalForm(level, extras, history.keys, true);
      break;
    } catch (err) {
      if (!isNeedMoreItems(err) && !(err instanceof Error && /items|module|must have/i.test(err.message))) {
        throw err;
      }
      missingKind = isNeedMoreItems(err) ? err.kind : "valid-paper";
    }
  }
  if (!form) {
    throw new Error("Could not assemble an all-new paper in time. Stop and try again, or wait a few minutes.");
  }

  if (!neededLlm) {
    report(70, "Refreshing unused writing prompts", "One paced Gemini call so the email and discussion stay unused");
    await enrichUntilUnseen(form, level, avoid, history.keys, signal, onWait, userId);
  } else {
    report(70, "Skipping extra writing refresh", "The model already ran for missing items; no second Gemini wave");
  }

  const finalErrors = [...validateForm(form), ...formUniquenessErrors(form, history.keys)];
  if (finalErrors.length) {
    throw new Error(`The paper failed uniqueness or count checks: ${[...new Set(finalErrors)].join("; ")}`);
  }
  report(74, "Paper is all new", "Every question is unused and unique on this paper");
  return form;
}

async function enrichUntilUnseen(
  form: TestFormPayload,
  level: ExamDifficulty,
  avoid: string[],
  seen: Set<string>,
  signal?: AbortSignal,
  onWait?: (info: GeminiWaitInfo) => void,
  userId?: string,
) {
  const keepEmail = { ...form.writing.email };
  const keepDiscussion = {
    ...form.writing.discussion,
    professor: { ...form.writing.discussion.professor },
    students: form.writing.discussion.students.map((row) => ({ ...row })),
  };
  if (!hasLlmKey()) return;
  throwIfAborted(signal);
  try {
    await enrichWithLlm(form, level, avoid, signal, onWait, userId);
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
  const paperErrors = formUniquenessErrors(form, seen);
  if (!emailSeen && !discussionSeen && !paperErrors.length) return;
  Object.assign(form.writing.email, keepEmail);
  form.writing.discussion.course = keepDiscussion.course;
  form.writing.discussion.professor = keepDiscussion.professor;
  form.writing.discussion.students = keepDiscussion.students;
  form.writing.discussion.prompt = keepDiscussion.prompt;
}

function validLocalForm(
  difficulty: ExamDifficulty,
  extras: GrownBank,
  seen: Set<string> = new Set(),
  strict = false,
): TestFormPayload {
  const form = assembleLocalForm(difficulty, extras, seen, strict);
  const errors = [...validateForm(form), ...formUniquenessErrors(form, seen)];
  if (errors.length) {
    if (strict) {
      throw new NeedMoreItems(kindFromAssembleErrors(errors));
    }
    const retry = assembleLocalForm(difficulty, extras, seen, strict);
    const retryErrors = [...validateForm(retry), ...formUniquenessErrors(retry, seen)];
    if (retryErrors.length) throw new Error(retryErrors.join("; "));
    return retry;
  }
  if (reusedSeenKeys(form, seen).length) throw new NeedMoreItems("uniqueness");
  return form;
}

export { validateForm };
