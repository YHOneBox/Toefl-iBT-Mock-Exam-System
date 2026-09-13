import type { Cefr, ExamDifficulty } from "../types";

export type DifficultyBand = "easier" | "standard" | "harder";

export type DifficultyProfile = {
  id: ExamDifficulty;
  label: string;
  summary: string;
  reading: {
    m1Ctw: [Cefr, Cefr];
    m2LowerCtw: Cefr;
    m2UpperCtw: Cefr;
    daily: DifficultyBand;
    academic: DifficultyBand;
  };
  listening: {
    m1: DifficultyBand;
    m2Lower: DifficultyBand;
    m2Upper: DifficultyBand;
  };
  writing: DifficultyBand;
};

export const DIFFICULTY_OPTIONS: DifficultyProfile[] = [
  {
    id: "easier",
    label: "Easier practice",
    summary: "More A2–B1 campus language. Same exam shape, gentler wording.",
    reading: {
      m1Ctw: ["B1", "B1"],
      m2LowerCtw: "B1",
      m2UpperCtw: "B2",
      daily: "easier",
      academic: "easier",
    },
    listening: { m1: "easier", m2Lower: "easier", m2Upper: "standard" },
    writing: "easier",
  },
  {
    id: "standard",
    label: "Real exam (standard)",
    summary: "Enhanced TOEFL iBT mix: Module 1 B1–B2, Module 2 splits easier/harder, 10 sentences + email + discussion.",
    reading: {
      m1Ctw: ["B1", "B2"],
      m2LowerCtw: "B1",
      m2UpperCtw: "C1",
      daily: "standard",
      academic: "standard",
    },
    listening: { m1: "standard", m2Lower: "easier", m2Upper: "harder" },
    writing: "standard",
  },
  {
    id: "harder",
    label: "Harder than exam",
    summary: "More B2–C1 academic language while keeping the official task counts and clocks.",
    reading: {
      m1Ctw: ["B2", "C1"],
      m2LowerCtw: "B2",
      m2UpperCtw: "C1",
      daily: "harder",
      academic: "harder",
    },
    listening: { m1: "harder", m2Lower: "standard", m2Upper: "harder" },
    writing: "harder",
  },
];

export function getDifficultyProfile(id: ExamDifficulty = "standard"): DifficultyProfile {
  return DIFFICULTY_OPTIONS.find((d) => d.id === id) || DIFFICULTY_OPTIONS[1];
}

export function parseDifficulty(value: unknown): ExamDifficulty {
  return value === "easier" || value === "harder" || value === "standard" ? value : "standard";
}

export function cefrAllowed(band: DifficultyBand): Cefr[] {
  if (band === "easier") return ["A2", "B1"];
  if (band === "harder") return ["B1", "B2", "C1"];
  return ["A2", "B1", "B2", "C1"];
}

export function difficultyLabel(id?: string | null) {
  return DIFFICULTY_OPTIONS.find((d) => d.id === id)?.label || "Real exam (standard)";
}
