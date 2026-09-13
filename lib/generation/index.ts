import { hasLlmKey } from "../llm";
import type { Cefr, ExamDifficulty, TestFormPayload } from "../types";
import { makeAcademicSet, makeCtwSet, makeDailySets } from "./bank-reading";
import { listeningBundleFor } from "./bank-listening";
import { makeSpeakingBundle } from "./bank-speaking";
import { makeWritingBundle } from "./bank-writing";
import { getDifficultyProfile, parseDifficulty } from "./difficulty";
import { enrichWithLlm } from "./llm-enrich";
import { validateForm } from "./validate";

function asCtw(cefr: Cefr): "B1" | "B2" | "C1" {
  if (cefr === "C1" || cefr === "C2") return "C1";
  if (cefr === "B2") return "B2";
  return "B1";
}

export function assembleLocalForm(difficulty: ExamDifficulty = "standard"): TestFormPayload {
  const d = getDifficultyProfile(difficulty);
  const ctw1a = makeCtwSet("m1", asCtw(d.reading.m1Ctw[0]));
  const ctw1b = makeCtwSet("m1", asCtw(d.reading.m1Ctw[1]), [ctw1a.fullPassage]);
  const form: TestFormPayload = {
    topics: [],
    difficulty,
    reading: {
      module1: {
        completeTheWords: [ctw1a, ctw1b],
        dailyLife: makeDailySets("m1", [2, 2, 3, 3], d.reading.daily),
        academic: [makeAcademicSet("m1", d.reading.academic)],
      },
      module2Lower: {
        completeTheWords: [makeCtwSet("m2", asCtw(d.reading.m2LowerCtw), [ctw1a.fullPassage, ctw1b.fullPassage])],
        dailyLife: makeDailySets("m2", [2, 3], d.reading.daily === "harder" ? "easier" : d.reading.daily),
        academic: [],
      },
      module2Upper: {
        completeTheWords: [makeCtwSet("m2", asCtw(d.reading.m2UpperCtw), [ctw1a.fullPassage, ctw1b.fullPassage])],
        dailyLife: makeDailySets("m2", [2, 3], d.reading.daily === "easier" ? "standard" : d.reading.daily),
        academic: [],
      },
    },
    listening: {
      module1: listeningBundleFor("m1", { choose: 16, conversations: 4, announcements: 2, talks: 1 }, { band: d.listening.m1 }),
      module2Lower: listeningBundleFor("m2", { choose: 5, conversations: 2, announcements: 1, talks: 1 }, { band: d.listening.m2Lower }),
      module2Upper: listeningBundleFor("m2", { choose: 5, conversations: 2, announcements: 1, talks: 1 }, { band: d.listening.m2Upper }),
    },
    writing: makeWritingBundle(d.writing),
    speaking: makeSpeakingBundle(),
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

export async function generateFormPayload(difficulty: ExamDifficulty = "standard"): Promise<TestFormPayload> {
  const level = parseDifficulty(difficulty);
  const form = validLocalForm(level);
  if (hasLlmKey()) {
    try {
      await enrichWithLlm(form, level);
    } catch {
      /* keep the validated local form */
    }
  }
  return form;
}

function validLocalForm(difficulty: ExamDifficulty): TestFormPayload {
  const form = assembleLocalForm(difficulty);
  const errors = validateForm(form);
  if (!errors.length) return form;
  const retry = assembleLocalForm(difficulty);
  const retryErrors = validateForm(retry);
  if (retryErrors.length) throw new Error(retryErrors.join("; "));
  return retry;
}

export { validateForm };
