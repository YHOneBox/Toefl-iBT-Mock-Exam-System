import type { RouteLevel, ScopePart, TestFormPayload } from "./types";
import { countReadingItems, countListeningItems, flattenListeningItems, flattenReadingSets, listeningQuestionIds, readingBundle, readingItemIds } from "./form";
import { matchGap, normalizeMcq, normalizeWords } from "./scoring";

export function routeFromAccuracy(correct: number, possible: number): RouteLevel {
  if (possible <= 0) return "lower";
  return correct / possible >= 0.6 ? "upper" : "lower";
}

export function scoreReadingModule(
  form: TestFormPayload,
  module: "m1" | RouteLevel,
  scope: ScopePart[],
  answers: Record<string, unknown>,
): { correct: number; possible: number } {
  const bundle = readingBundle(form, module);
  let correct = 0;
  let possible = 0;
  for (const set of flattenReadingSets(bundle, scope)) {
    if (set.taskType === "complete_the_words") {
      const words = normalizeWords(answers[set.id] ?? answers);
      for (const token of set.tokens) {
        if (!token.isGap || !token.itemId) continue;
        possible += 1;
        const given = String(words[token.itemId] ?? "");
        if (matchGap(given, token.answer || "", token.aliases)) correct += 1;
      }
    } else {
      for (const q of set.questions) {
        possible += 1;
        if (normalizeMcq(answers[q.id]) === q.answerKey) correct += 1;
      }
    }
  }
  return { correct, possible };
}

export function scoreListeningModule(
  form: TestFormPayload,
  module: "m1" | RouteLevel,
  scope: ScopePart[],
  answers: Record<string, unknown>,
): { correct: number; possible: number } {
  const bundle = module === "m1" ? form.listening.module1 : module === "upper" ? form.listening.module2Upper : form.listening.module2Lower;
  let correct = 0;
  let possible = 0;
  for (const entry of flattenListeningItems(bundle, scope)) {
    for (const id of listeningQuestionIds(entry)) {
      possible += 1;
      const key = entry.kind === "choose" ? entry.item.answerKey : entry.item.questions.find((q) => q.id === id)?.answerKey;
      if (normalizeMcq(answers[id]) === key) correct += 1;
    }
  }
  return { correct, possible };
}

export function readingItemCount(form: TestFormPayload, module: "m1" | RouteLevel, scope: ScopePart[]) {
  return countReadingItems(readingBundle(form, module), scope);
}

export function listeningItemCount(form: TestFormPayload, module: "m1" | RouteLevel, scope: ScopePart[]) {
  const bundle = module === "m1" ? form.listening.module1 : module === "upper" ? form.listening.module2Upper : form.listening.module2Lower;
  return countListeningItems(bundle, scope);
}

export function allReadingIds(form: TestFormPayload, module: "m1" | RouteLevel, scope: ScopePart[]): string[] {
  return flattenReadingSets(readingBundle(form, module), scope).flatMap(readingItemIds);
}
