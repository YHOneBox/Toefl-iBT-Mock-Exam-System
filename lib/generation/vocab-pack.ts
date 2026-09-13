import type { ExamDifficulty } from "../types";
import { pick, pickOne } from "./util";

export const ACADEMIC_DISCIPLINES = [
  {
    name: "History and Anthropology",
    angles: ["ancient settlements", "archaeology", "migration", "societal change", "early trade"],
  },
  {
    name: "Life Sciences",
    angles: ["ecology", "biomes", "plant and animal distribution", "symbiosis", "migration of organisms"],
  },
  {
    name: "Physical Sciences",
    angles: ["geology", "oceanography", "climate", "properties of matter", "ice and water"],
  },
  {
    name: "Social Sciences",
    angles: ["urban development", "community ties", "social integration", "public space", "housing"],
  },
  {
    name: "Art and Music",
    angles: ["art history", "performance spaces", "visual culture", "early media", "public monuments"],
  },
  {
    name: "Business and Economics",
    angles: ["management", "supply chains", "industrial history", "work measurement", "inventory"],
  },
] as const;

export const CAMPUS_CONTEXTS = [
  "syllabus change",
  "course registration",
  "grade review",
  "library hours or reserves",
  "tech bar / printer",
  "dining hall or meal plan",
  "dorm repair or housing",
  "recreation center",
  "wellness or counseling appointment",
  "club contest or event",
  "study group or group project",
  "campus shuttle",
  "lab safety or equipment",
  "writing center booking",
] as const;

export const DAILY_FORMATS = [
  "email",
  "notice",
  "sign",
  "menu",
  "social post",
  "schedule",
  "text-message chain",
  "form",
] as const;

export const ACADEMIC_WORD_EXAMPLES = [
  "locomotion",
  "immense",
  "exceed",
  "impromptu",
  "figures",
  "prized",
  "subsequent",
  "nevertheless",
  "consequently",
  "furthermore",
  "initially",
  "distribution",
  "regulate",
  "retain",
  "interpret",
  "decline",
  "stable",
  "distinctive",
  "estimate",
  "priority",
] as const;

export const COHESIVE_DEVICES = {
  contrast: ["however", "nevertheless", "instead", "by contrast"],
  conclusion: ["therefore", "consequently", "as a result", "hence"],
  addition: ["additionally", "furthermore", "moreover"],
  sequence: ["initially", "subsequently", "next"],
  example: ["for example", "for instance", "such as"],
  similarity: ["similarly", "likewise"],
} as const;

export const ITEM_WRITING_RULES = [
  "Write original practice only. Do not copy ETS or Official Guide wording.",
  "Correct options must paraphrase the stimulus, not quote it.",
  "Distractors reuse words from the stimulus but twist the relationship, exaggerate, or reverse the claim.",
  "Keep academic content introductory. No specialized prior knowledge.",
  "Keep content culturally neutral and appropriate for a general adult audience.",
  "Academic words should be inferable from context, roots, or affixes.",
].join(" ");

export function cefrHint(difficulty: ExamDifficulty): string {
  if (difficulty === "easier") return "A2–B1 campus English, shorter sentences, clear facts";
  if (difficulty === "harder") return "B2–C1 academic English, denser reasons, still introductory university level";
  return "enhanced TOEFL iBT mix: B1–B2 campus and introductory academic English";
}

export function retrieveItemContext(
  kind:
    | "ctw"
    | "daily"
    | "academic"
    | "choose"
    | "conversation"
    | "announcement"
    | "talk"
    | "sentence"
    | "email"
    | "discussion"
    | "speaking",
  difficulty: ExamDifficulty,
  avoid: string[] = [],
): string {
  const blocked = new Set(avoid.map((item) => item.toLowerCase()));
  const disciplines = ACADEMIC_DISCIPLINES.filter((row) => !blocked.has(row.name.toLowerCase()));
  const discipline = pickOne(disciplines.length ? [...disciplines] : [...ACADEMIC_DISCIPLINES]);
  const angle = pickOne([...discipline.angles]);
  const campus = pickOne(
    CAMPUS_CONTEXTS.filter((row) => !blocked.has(row.toLowerCase())).length
      ? CAMPUS_CONTEXTS.filter((row) => !blocked.has(row.toLowerCase()))
      : [...CAMPUS_CONTEXTS],
  );
  const format = pickOne([...DAILY_FORMATS]);
  const words = pick([...ACADEMIC_WORD_EXAMPLES], 6).join(", ");
  const cohesive = pick(
    Object.values(COHESIVE_DEVICES).flat(),
    4,
  ).join(", ");
  const level = cefrHint(difficulty);
  const avoidLine = avoid.length ? `Do not reuse these topics or titles: ${avoid.slice(0, 16).join("; ")}.` : "";

  const academicFocus = `Discipline: ${discipline.name}. Angle: ${angle}. Weave in at least two of these cohesive devices naturally: ${cohesive}. Academic words that may appear if they fit: ${words}.`;
  const campusFocus = `Campus/daily context: ${campus}. Format hint: ${format}.`;

  if (kind === "ctw" || kind === "academic" || kind === "talk") {
    return `${ITEM_WRITING_RULES} Difficulty: ${level}. ${academicFocus} ${avoidLine}`;
  }
  if (
    kind === "daily" ||
    kind === "choose" ||
    kind === "conversation" ||
    kind === "announcement" ||
    kind === "sentence" ||
    kind === "email"
  ) {
    return `${ITEM_WRITING_RULES} Difficulty: ${level}. ${campusFocus} ${avoidLine}`;
  }
  if (kind === "discussion") {
    return `${ITEM_WRITING_RULES} Difficulty: ${level}. ${academicFocus} Keep the prompt introductory. ${avoidLine}`;
  }
  return `${ITEM_WRITING_RULES} Difficulty: ${level}. ${campusFocus} ${academicFocus} ${avoidLine}`;
}
