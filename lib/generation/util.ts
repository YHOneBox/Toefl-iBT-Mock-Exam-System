import { makeId } from "../ids";
import type { Accent, AudioRef, Cefr, McqQuestion } from "../types";

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pick<T>(items: T[], n: number): T[] {
  return shuffle(items).slice(0, n);
}

export function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function mcq(
  stem: string,
  options: [string, string, string, string],
  answerKey: number,
  rationale: string,
  skill = "factual",
  cefr: Cefr = "B1",
): McqQuestion {
  return { id: makeId("q"), skill, cefr, stem, options, answerKey, rationale };
}

export function audio(
  script: string,
  accent: Accent = "us",
  gender: "male" | "female" = "female",
  rate?: number,
): AudioRef {
  return { script, accent, gender, fallbackTts: true, ...(rate && rate !== 1 ? { rate } : {}) };
}

export function joinScript(lines: Array<{ speakerId: string; text: string }>, speakers: Array<{ id: string; label: string }>) {
  return lines
    .map((line) => {
      const name = speakers.find((s) => s.id === line.speakerId)?.label || line.speakerId;
      return `${name}: ${line.text}`;
    })
    .join("\n");
}
