import type { Cefr, RawScores, ScoreBands, SectionName } from "./types";

export const READING_RAW_MAX = 30;
export const LISTENING_RAW_MAX = 30;
export const WRITING_RAW_MAX = 20;
export const SPEAKING_RAW_MAX = 55;

const READING_BAND: Array<[number, number]> = [
  [29, 6],
  [27, 5.5],
  [24, 5],
  [22, 4.5],
  [18, 4],
  [12, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [2, 1.5],
  [0, 1],
];

const LISTENING_BAND: Array<[number, number]> = [
  [28, 6],
  [26, 5.5],
  [22, 5],
  [20, 4.5],
  [17, 4],
  [13, 3.5],
  [9, 3],
  [6, 2.5],
  [4, 2],
  [2, 1.5],
  [0, 1],
];

const WRITING_BAND: Array<[number, number]> = [
  [20, 6],
  [18, 5.5],
  [16, 5],
  [14, 4.5],
  [12, 4],
  [10, 3.5],
  [8, 3],
  [6, 2.5],
  [4, 2],
  [2, 1.5],
  [0, 1],
];

const SPEAKING_BAND: Array<[number, number]> = [
  [52, 6],
  [47, 5.5],
  [42, 5],
  [37, 4.5],
  [32, 4],
  [27, 3.5],
  [22, 3],
  [16, 2.5],
  [11, 2],
  [6, 1.5],
  [0, 1],
];

const OVERALL_TO_120: Record<string, number> = {
  "6": 117,
  "5.5": 110,
  "5": 99,
  "4.5": 88,
  "4": 76,
  "3.5": 63,
  "3": 48,
  "2.5": 36,
  "2": 26,
  "1.5": 14,
  "1": 4,
};

export function rawToBand(raw: number, table: Array<[number, number]>): number {
  const sorted = [...table].sort((a, b) => b[0] - a[0]);
  for (const [min, band] of sorted) {
    if (raw >= min) return band;
  }
  return 1;
}

export function readingBand(scaled0to30: number) {
  return rawToBand(Math.round(scaled0to30), READING_BAND);
}

export function listeningBand(scaled0to30: number) {
  return rawToBand(Math.round(scaled0to30), LISTENING_BAND);
}

export function writingBand(raw0to20: number) {
  return rawToBand(raw0to20, WRITING_BAND);
}

export function speakingBand(raw0to55: number) {
  return rawToBand(raw0to55, SPEAKING_BAND);
}

export function cefrFromBand(band: number): Cefr {
  if (band >= 6) return "C2";
  if (band >= 5) return "C1";
  if (band >= 4) return "B2";
  if (band >= 3) return "B1";
  if (band >= 2) return "A2";
  return "A1";
}

export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function overallBand(sections: Array<number | undefined>): number | undefined {
  const present = sections.filter((x): x is number => typeof x === "number");
  if (present.length === 0) return undefined;
  return roundHalf(present.reduce((a, b) => a + b, 0) / present.length);
}

export function comparable120(band: number): number {
  const key = String(band);
  return OVERALL_TO_120[key] ?? Math.round((band / 6) * 120);
}

export function scaleAdaptive(
  module1Correct: number,
  module1Possible: number,
  module2Correct: number,
  module2Possible: number,
  route: "lower" | "upper",
  targetMax: number,
): number {
  const m2Weight = route === "upper" ? 1.15 : 0.85;
  const earned = module1Correct + module2Correct * m2Weight;
  const possible = module1Possible + module2Possible * m2Weight;
  if (possible <= 0) return 0;
  return Math.max(0, Math.min(targetMax, (earned / possible) * targetMax));
}

export function normalizeMcq(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export function normalizeWords(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = String(v ?? "").trim();
  }
  return out;
}

export function matchGap(given: string, answer: string, aliases: string[] = []): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/[^a-z']/g, "");
  const g = n(given);
  if (!g) return false;
  return [answer, ...aliases].some((a) => n(a) === g);
}

export function matchSentence(given: string[], answer: string[], alternates: string[][] = []): boolean {
  const n = (arr: string[]) => arr.map((x) => x.trim().toLowerCase()).join(" ");
  const g = n(given);
  return [answer, ...alternates].some((a) => n(a) === g);
}

export function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = tokenize(reference);
  const hyp = tokenize(hypothesis);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  const dp: number[][] = Array.from({ length: ref.length + 1 }, () =>
    Array(hyp.length + 1).fill(0),
  );
  for (let i = 0; i <= ref.length; i++) dp[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) dp[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[ref.length][hyp.length] / ref.length;
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function repeatScoreFromWer(wer: number, hasAttempt: boolean): number {
  if (!hasAttempt) return 0;
  if (wer <= 0.02) return 5;
  if (wer <= 0.12) return 4;
  if (wer <= 0.28) return 3;
  if (wer <= 0.5) return 2;
  if (wer < 0.85) return 1;
  return 0;
}

export function classic30Scores(raw: RawScores) {
  return {
    reading: raw.reading ? Math.round(raw.reading.scaled) : undefined,
    listening: raw.listening ? Math.round(raw.listening.scaled) : undefined,
    writing: raw.writing ? Math.round((raw.writing.total / WRITING_RAW_MAX) * 30) : undefined,
    speaking: raw.speaking ? Math.round((raw.speaking.total / SPEAKING_RAW_MAX) * 30) : undefined,
  };
}

export function buildBands(raw: RawScores, present: SectionName[]): ScoreBands {
  const bands: ScoreBands = {};
  if (present.includes("reading") && raw.reading) {
    bands.reading = readingBand(raw.reading.scaled);
  }
  if (present.includes("listening") && raw.listening) {
    bands.listening = listeningBand(raw.listening.scaled);
  }
  if (present.includes("writing") && raw.writing) {
    bands.writing = writingBand(raw.writing.total);
  }
  if (present.includes("speaking") && raw.speaking) {
    bands.speaking = speakingBand(raw.speaking.total);
  }
  bands.overall = overallBand([bands.reading, bands.listening, bands.writing, bands.speaking]);
  return bands;
}

export const CONVERSION_NOTES = {
  method:
    "Estimated bands, not official ETS IRT. Reading/Listening use difficulty-weighted module scores scaled to 0-30, then a published-style lookup. Writing uses 0-20 (10 sentence + 5 email + 5 discussion). Speaking uses 0-55 (7x5 + 4x5).",
  tables: {
    reading: READING_BAND,
    listening: LISTENING_BAND,
    writing: WRITING_BAND,
    speaking: SPEAKING_BAND,
    overallTo120: OVERALL_TO_120,
  },
};
