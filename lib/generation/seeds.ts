import type {
  AcademicSet,
  BuildSentenceItem,
  DailyLifeSet,
  ListenChooseItem,
  SpokenSet,
} from "../types";

export type CtwSeed = { topic: string; text: string };

export type DailySeed = Omit<DailyLifeSet, "id" | "module" | "taskType">;

export type AcademicSeed = Omit<AcademicSet, "id" | "module" | "taskType">;

export type ChooseSeed = Omit<ListenChooseItem, "id" | "module" | "taskType" | "audio"> & {
  script: string;
};

export type SpokenSeed = Omit<SpokenSet, "id" | "module" | "audio" | "lineAudio">;

export type SentenceSeed = Omit<BuildSentenceItem, "id" | "taskType">;

export type RepeatSeed = {
  scenario: string;
  setting: string;
  sentences: string[];
};

export type InterviewSeed = {
  scenario: string;
  interviewer: string;
  questions: string[];
};

export type GrownBank = {
  version: 1;
  ctw: CtwSeed[];
  daily: DailySeed[];
  academic: AcademicSeed[];
  choose: ChooseSeed[];
  conversations: SpokenSeed[];
  announcements: SpokenSeed[];
  talks: SpokenSeed[];
  sentences: SentenceSeed[];
  repeats: RepeatSeed[];
  interviews: InterviewSeed[];
};

export function emptyGrownBank(): GrownBank {
  return {
    version: 1,
    ctw: [],
    daily: [],
    academic: [],
    choose: [],
    conversations: [],
    announcements: [],
    talks: [],
    sentences: [],
    repeats: [],
    interviews: [],
  };
}
