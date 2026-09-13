export const SECTIONS = ["reading", "listening", "writing", "speaking"] as const;
export type SectionName = (typeof SECTIONS)[number];

export const TASK_TYPES = [
  "complete_the_words",
  "read_daily_life",
  "read_academic",
  "listen_choose_response",
  "listen_conversation",
  "listen_announcement",
  "listen_academic_talk",
  "build_sentence",
  "write_email",
  "write_discussion",
  "listen_repeat",
  "take_interview",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ModuleTag = "m1" | "m2" | "linear";
export type Accent = "us" | "uk" | "au";
export type RouteLevel = "lower" | "upper";
export type SessionMode = "new" | "retake" | "redo";
export const EXAM_DIFFICULTIES = ["easier", "standard", "harder"] as const;
export type ExamDifficulty = (typeof EXAM_DIFFICULTIES)[number];
export type SessionStatus =
  | "preparing"
  | "checkin"
  | "in_progress"
  | "scoring"
  | "completed"
  | "discarded";

export type ScopePart =
  | "full"
  | SectionName
  | `${SectionName}:${TaskType}`;

export type McqQuestion = {
  id: string;
  skill: string;
  cefr: Cefr;
  stem: string;
  options: [string, string, string, string];
  answerKey: number;
  rationale: string;
  insertSentence?: string;
  insertPositions?: number[];
};

export type CompleteTheWordsSet = {
  id: string;
  taskType: "complete_the_words";
  module: ModuleTag;
  cefr: Cefr;
  topic: string;
  firstSentence: string;
  tokens: Array<{
    text: string;
    isGap: boolean;
    prefix?: string;
    answer?: string;
    aliases?: string[];
    itemId?: string;
    punct?: string;
  }>;
  fullPassage: string;
};

export type DailyLifeSet = {
  id: string;
  taskType: "read_daily_life";
  module: ModuleTag;
  cefr: Cefr;
  topic: string;
  format: string;
  title: string;
  text: string;
  questions: McqQuestion[];
};

export type AcademicSet = {
  id: string;
  taskType: "read_academic";
  module: ModuleTag;
  cefr: Cefr;
  topic: string;
  title: string;
  text: string;
  questions: McqQuestion[];
};

export type ReadingBundle = {
  completeTheWords: CompleteTheWordsSet[];
  dailyLife: DailyLifeSet[];
  academic: AcademicSet[];
};

export type AudioRef = {
  path?: string;
  script: string;
  accent: Accent;
  gender: "male" | "female";
  fallbackTts: boolean;
};

export type ListenChooseItem = {
  id: string;
  taskType: "listen_choose_response";
  module: ModuleTag;
  cefr: Cefr;
  skill: string;
  audio: AudioRef;
  options: [string, string, string, string];
  answerKey: number;
  rationale: string;
};

export type SpokenSet = {
  id: string;
  taskType: "listen_conversation" | "listen_announcement" | "listen_academic_talk";
  module: ModuleTag;
  cefr: Cefr;
  topic: string;
  title: string;
  speakers: Array<{ id: string; label: string; gender: "male" | "female"; accent: Accent }>;
  script: Array<{ speakerId: string; text: string }>;
  audio: AudioRef;
  questions: McqQuestion[];
};

export type ListeningBundle = {
  choose: ListenChooseItem[];
  conversations: SpokenSet[];
  announcements: SpokenSet[];
  talks: SpokenSet[];
};

export type BuildSentenceItem = {
  id: string;
  taskType: "build_sentence";
  cefr: Cefr;
  exchange: string;
  tokens: string[];
  answer: string[];
  alternates?: string[][];
  rationale: string;
};

export type EmailTask = {
  id: string;
  taskType: "write_email";
  cefr: Cefr;
  scenario: string;
  audience: string;
  goal: string;
  sampleAnswer?: string;
};

export type DiscussionTask = {
  id: string;
  taskType: "write_discussion";
  cefr: Cefr;
  course: string;
  professor: { name: string; text: string };
  students: Array<{ name: string; text: string }>;
  prompt: string;
  sampleAnswer?: string;
};

export type WritingBundle = {
  sentences: BuildSentenceItem[];
  email: EmailTask;
  discussion: DiscussionTask;
};

export type RepeatItem = {
  id: string;
  taskType: "listen_repeat";
  sentence: string;
  seconds: 8 | 10 | 12;
  audio: AudioRef;
};

export type InterviewItem = {
  id: string;
  taskType: "take_interview";
  prompt: string;
  seconds: 45;
  focus: "fact" | "reaction" | "opinion" | "policy";
  audio: AudioRef;
};

export type SpeakingBundle = {
  listenRepeat: {
    scenario: string;
    setting: string;
    items: RepeatItem[];
  };
  interview: {
    scenario: string;
    interviewer: string;
    items: InterviewItem[];
  };
};

export type TestFormPayload = {
  topics: string[];
  difficulty?: ExamDifficulty;
  reading: {
    module1: ReadingBundle;
    module2Lower: ReadingBundle;
    module2Upper: ReadingBundle;
  };
  listening: {
    module1: ListeningBundle;
    module2Lower: ListeningBundle;
    module2Upper: ListeningBundle;
  };
  writing: WritingBundle;
  speaking: SpeakingBundle;
};

export type ExamItem = {
  id: string;
  section: SectionName;
  taskType: TaskType;
  module?: ModuleTag | RouteLevel;
  setId?: string;
  label: string;
};

export type Pointer =
  | "checkin"
  | "directions:reading"
  | "reading:m1"
  | "reading:review-m1"
  | "reading:m2"
  | "reading:review-m2"
  | "directions:listening"
  | "listening:m1"
  | "listening:m2"
  | "directions:writing"
  | "writing:sentences"
  | "writing:email"
  | "writing:discussion"
  | "directions:speaking"
  | "speaking:check"
  | "speaking:repeat"
  | "speaking:interview"
  | "scoring"
  | "completed";

export type ScoreBands = {
  reading?: number;
  listening?: number;
  writing?: number;
  speaking?: number;
  overall?: number;
  projectedOverall?: number;
};

export type RawScores = {
  reading?: { correct: number; possible: number; scaled: number; route?: RouteLevel };
  listening?: { correct: number; possible: number; scaled: number; route?: RouteLevel };
  writing?: { sentence: number; email: number; discussion: number; total: number };
  speaking?: { repeat: number; interview: number; total: number };
};
