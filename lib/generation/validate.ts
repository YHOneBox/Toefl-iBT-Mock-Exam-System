import type { ListeningBundle, ReadingBundle, SectionName, TestFormPayload } from "../types";
import { isFullScope, sectionEnabled, taskEnabled, normalizeScope } from "../scope";
import { uniquenessIssues } from "./uniqueness";

function wholeSection(scope: ReturnType<typeof normalizeScope>, section: SectionName) {
  return isFullScope(scope) || scope.includes(section);
}

function countReading(bundle: ReadingBundle): number {
  const ctw = bundle.completeTheWords.reduce(
    (n, set) => n + set.tokens.filter((t) => t.isGap).length,
    0,
  );
  const daily = bundle.dailyLife.reduce((n, set) => n + set.questions.length, 0);
  const acad = bundle.academic.reduce((n, set) => n + set.questions.length, 0);
  return ctw + daily + acad;
}

function countListening(bundle: ListeningBundle): number {
  return (
    bundle.choose.length +
    bundle.conversations.reduce((n, s) => n + s.questions.length, 0) +
    bundle.announcements.reduce((n, s) => n + s.questions.length, 0) +
    bundle.talks.reduce((n, s) => n + s.questions.length, 0)
  );
}

export function validateForm(form: TestFormPayload): string[] {
  const errors: string[] = [];
  const scope = normalizeScope(form.scope);
  if (sectionEnabled(scope, "reading")) {
    if (taskEnabled(scope, "reading", "complete_the_words") || taskEnabled(scope, "reading", "read_daily_life") || taskEnabled(scope, "reading", "read_academic")) {
      const r1 = countReading(form.reading.module1);
      const r2l = countReading(form.reading.module2Lower);
      const r2u = countReading(form.reading.module2Upper);
      if (wholeSection(scope, "reading")) {
        if (r1 < 30) errors.push(`Reading module 1 has ${r1} items`);
        if (r2l < 12) errors.push(`Reading module 2 lower has ${r2l} items`);
        if (r2u < 12) errors.push(`Reading module 2 upper has ${r2u} items`);
      } else if (r1 + r2l + r2u < 1) {
        errors.push("Reading has no items");
      }
    }
  }
  if (sectionEnabled(scope, "listening") && wholeSection(scope, "listening")) {
    const l1 = countListening(form.listening.module1);
    const l2l = countListening(form.listening.module2Lower);
    const l2u = countListening(form.listening.module2Upper);
    if (l1 < 28) errors.push(`Listening module 1 has ${l1} items`);
    if (l2l < 12) errors.push(`Listening module 2 lower has ${l2l} items`);
    if (l2u < 12) errors.push(`Listening module 2 upper has ${l2u} items`);
  }
  if (sectionEnabled(scope, "listening") && !wholeSection(scope, "listening")) {
    const total =
      countListening(form.listening.module1) +
      countListening(form.listening.module2Lower) +
      countListening(form.listening.module2Upper);
    if (total < 1) errors.push("Listening has no items");
  }
  if (taskEnabled(scope, "writing", "build_sentence") && form.writing.sentences.length !== 10) {
    errors.push("Writing must have 10 sentence items");
  }
  if (taskEnabled(scope, "speaking", "listen_repeat") && form.speaking.listenRepeat.items.length !== 7) {
    errors.push("Listen and Repeat must have 7 items");
  }
  if (taskEnabled(scope, "speaking", "take_interview") && form.speaking.interview.items.length !== 4) {
    errors.push("Interview must have 4 items");
  }
  for (const set of [
    ...form.reading.module1.completeTheWords,
    ...form.reading.module2Lower.completeTheWords,
    ...form.reading.module2Upper.completeTheWords,
  ]) {
    const gaps = set.tokens.filter((t) => t.isGap);
    if (gaps.length !== 10) errors.push(`CTW set ${set.id} has ${gaps.length} gaps`);
    const words = set.fullPassage.split(/\s+/).length;
    if (words < 68 || words > 110) errors.push(`CTW set ${set.id} word count ${words}`);
  }
  errors.push(...uniquenessIssues(form));
  return errors;
}
