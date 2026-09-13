import { hasLlmKey } from "../llm";
import type { Cefr, ExamDifficulty, TestFormPayload } from "../types";
import { makeAcademicSet, makeCtwSet, makeDailySets } from "./bank-reading";
import { listeningBundleFor } from "./bank-listening";
import { makeSpeakingBundle } from "./bank-speaking";
import { makeWritingBundle } from "./bank-writing";
import { getDifficultyProfile, parseDifficulty } from "./difficulty";
import { appendGrownBank, loadGrownBank } from "./grown-bank";
import { fingerprintsFromForm, labelsFromForm, rememberSeen, seenForUser } from "./history";
import { createFreshItems } from "./llm-create";
import { enrichWithLlm } from "./llm-enrich";
import { emptyGrownBank, type GrownBank } from "./seeds";
import { validateForm } from "./validate";

function asCtw(cefr: Cefr): "B1" | "B2" | "C1" {
  if (cefr === "C1" || cefr === "C2") return "C1";
  if (cefr === "B2") return "B2";
  return "B1";
}

export function assembleLocalForm(
  difficulty: ExamDifficulty = "standard",
  extras: GrownBank = emptyGrownBank(),
  seen: Set<string> = new Set(),
): TestFormPayload {
  const d = getDifficultyProfile(difficulty);
  const ctwExclude: string[] = [];
  const ctw1a = makeCtwSet("m1", asCtw(d.reading.m1Ctw[0]), ctwExclude, extras.ctw, seen);
  ctwExclude.push(ctw1a.fullPassage);
  const ctw1b = makeCtwSet("m1", asCtw(d.reading.m1Ctw[1]), ctwExclude, extras.ctw, seen);
  ctwExclude.push(ctw1b.fullPassage);
  const dailyUsedM1 = new Set<string>();
  const academicUsed = new Set<string>();
  const listenUsedM1 = { scripts: new Set<string>(), titles: new Set<string>() };
  const ctw2l = makeCtwSet("m2", asCtw(d.reading.m2LowerCtw), ctwExclude, extras.ctw, seen);
  ctwExclude.push(ctw2l.fullPassage);
  const ctw2u = makeCtwSet("m2", asCtw(d.reading.m2UpperCtw), ctwExclude, extras.ctw, seen);
  const form: TestFormPayload = {
    topics: [],
    difficulty,
    reading: {
      module1: {
        completeTheWords: [ctw1a, ctw1b],
        dailyLife: makeDailySets("m1", [2, 2, 3, 3], d.reading.daily, extras.daily, dailyUsedM1, seen),
        academic: [makeAcademicSet("m1", d.reading.academic, extras.academic, academicUsed, seen)],
      },
      module2Lower: {
        completeTheWords: [ctw2l],
        dailyLife: makeDailySets(
          "m2",
          [2, 3],
          d.reading.daily === "harder" ? "easier" : d.reading.daily,
          extras.daily,
          new Set(dailyUsedM1),
          seen,
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
          new Set(dailyUsedM1),
          seen,
        ),
        academic: [],
      },
    },
    listening: {
      module1: listeningBundleFor(
        "m1",
        { choose: 16, conversations: 4, announcements: 2, talks: 1 },
        { band: d.listening.m1, extras, used: listenUsedM1, seen },
      ),
      module2Lower: listeningBundleFor(
        "m2",
        { choose: 5, conversations: 2, announcements: 1, talks: 1 },
        {
          band: d.listening.m2Lower,
          extras,
          used: { scripts: new Set(listenUsedM1.scripts), titles: new Set(listenUsedM1.titles) },
          seen,
        },
      ),
      module2Upper: listeningBundleFor(
        "m2",
        { choose: 5, conversations: 2, announcements: 1, talks: 1 },
        {
          band: d.listening.m2Upper,
          extras,
          used: { scripts: new Set(listenUsedM1.scripts), titles: new Set(listenUsedM1.titles) },
          seen,
        },
      ),
    },
    writing: makeWritingBundle(d.writing, extras.sentences, seen),
    speaking: makeSpeakingBundle({ repeats: extras.repeats, interviews: extras.interviews }, seen),
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
): Promise<TestFormPayload> {
  const level = parseDifficulty(difficulty);
  const history = userId ? await seenForUser(userId) : { keys: new Set<string>(), labels: [] as string[] };
  let extras = loadGrownBank();
  let form = validLocalForm(level, extras, history.keys);
  if (hasLlmKey()) {
    try {
      const created = await createFreshItems(level, form, history.labels);
      if (created.added > 0) {
        extras = appendGrownBank(created.bank);
        form = validLocalForm(level, extras, history.keys);
      }
    } catch {
      /* keep the validated local form */
    }
    try {
      await enrichWithLlm(form, level, history.labels);
    } catch {
      /* keep the validated local form */
    }
  }
  if (userId) rememberSeen(userId, fingerprintsFromForm(form), labelsFromForm(form));
  return form;
}

function validLocalForm(difficulty: ExamDifficulty, extras: GrownBank, seen: Set<string> = new Set()): TestFormPayload {
  const form = assembleLocalForm(difficulty, extras, seen);
  const errors = validateForm(form);
  if (!errors.length) return form;
  const retry = assembleLocalForm(difficulty, extras, seen);
  const retryErrors = validateForm(retry);
  if (retryErrors.length) throw new Error(retryErrors.join("; "));
  return retry;
}

export { validateForm };
