import type { ListeningBundle, ReadingBundle, TestFormPayload } from "../types";

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
  const r1 = countReading(form.reading.module1);
  const r2l = countReading(form.reading.module2Lower);
  const r2u = countReading(form.reading.module2Upper);
  if (r1 < 30) errors.push(`Reading module 1 has ${r1} items`);
  if (r2l < 12) errors.push(`Reading module 2 lower has ${r2l} items`);
  if (r2u < 12) errors.push(`Reading module 2 upper has ${r2u} items`);
  const l1 = countListening(form.listening.module1);
  const l2l = countListening(form.listening.module2Lower);
  const l2u = countListening(form.listening.module2Upper);
  if (l1 < 28) errors.push(`Listening module 1 has ${l1} items`);
  if (l2l < 12) errors.push(`Listening module 2 lower has ${l2l} items`);
  if (l2u < 12) errors.push(`Listening module 2 upper has ${l2u} items`);
  if (form.writing.sentences.length !== 10) errors.push("Writing must have 10 sentence items");
  if (form.speaking.listenRepeat.items.length !== 7) errors.push("Listen and Repeat must have 7 items");
  if (form.speaking.interview.items.length !== 4) errors.push("Interview must have 4 items");
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
  const ctwTexts = [
    ...form.reading.module1.completeTheWords,
    ...form.reading.module2Lower.completeTheWords,
    ...form.reading.module2Upper.completeTheWords,
  ].map((set) => set.fullPassage.trim());
  if (new Set(ctwTexts).size !== ctwTexts.length) errors.push("Complete the Words passages are reused across modules");

  // Module 2 lower and upper may share leftovers on purpose: only one route is administered.
  const m1Daily = titlesOf(form.reading.module1.dailyLife);
  const m1Choose = form.listening.module1.choose.map((item) => item.audio.script.trim());
  const m1Spoken = spokenTitles(form.listening.module1);
  if (overlap(m1Daily, titlesOf(form.reading.module2Lower.dailyLife))) {
    errors.push("Daily-life texts reused between Reading module 1 and module 2 lower");
  }
  if (overlap(m1Daily, titlesOf(form.reading.module2Upper.dailyLife))) {
    errors.push("Daily-life texts reused between Reading module 1 and module 2 upper");
  }
  if (overlap(m1Choose, form.listening.module2Lower.choose.map((item) => item.audio.script.trim()))) {
    errors.push("Listen and Choose scripts reused between Listening module 1 and module 2 lower");
  }
  if (overlap(m1Choose, form.listening.module2Upper.choose.map((item) => item.audio.script.trim()))) {
    errors.push("Listen and Choose scripts reused between Listening module 1 and module 2 upper");
  }
  if (overlap(m1Spoken, spokenTitles(form.listening.module2Lower))) {
    errors.push("Spoken listening sets reused between Listening module 1 and module 2 lower");
  }
  if (overlap(m1Spoken, spokenTitles(form.listening.module2Upper))) {
    errors.push("Spoken listening sets reused between Listening module 1 and module 2 upper");
  }
  return errors;
}

function titlesOf(items: Array<{ title: string }>): string[] {
  return items.map((item) => item.title.trim());
}

function spokenTitles(bundle: ListeningBundle): string[] {
  return [...bundle.conversations, ...bundle.announcements, ...bundle.talks].map((set) => set.title.trim());
}

function overlap(a: string[], b: string[]): boolean {
  const left = new Set(a.filter(Boolean));
  return b.some((item) => item && left.has(item));
}
