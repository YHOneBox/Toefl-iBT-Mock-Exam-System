import type {
  AcademicSet,
  CompleteTheWordsSet,
  DailyLifeSet,
  ListeningBundle,
  Pointer,
  ReadingBundle,
  RepeatItem,
  RouteLevel,
  ScopePart,
  SpokenSet,
  TaskType,
  TestFormPayload,
} from "./types";
import { taskEnabled } from "./scope";

export function parseForm(payloadJson: string): TestFormPayload {
  return JSON.parse(payloadJson) as TestFormPayload;
}

export function readingBundle(form: TestFormPayload, module: "m1" | RouteLevel): ReadingBundle {
  if (module === "m1") return form.reading.module1;
  return module === "upper" ? form.reading.module2Upper : form.reading.module2Lower;
}

export function listeningBundle(form: TestFormPayload, module: "m1" | RouteLevel): ListeningBundle {
  if (module === "m1") return form.listening.module1;
  return module === "upper" ? form.listening.module2Upper : form.listening.module2Lower;
}

export function flattenReadingSets(bundle: ReadingBundle, scope: ScopePart[]) {
  const sets: Array<CompleteTheWordsSet | DailyLifeSet | AcademicSet> = [];
  if (taskEnabled(scope, "reading", "complete_the_words")) sets.push(...bundle.completeTheWords);
  if (taskEnabled(scope, "reading", "read_daily_life")) sets.push(...bundle.dailyLife);
  if (taskEnabled(scope, "reading", "read_academic")) sets.push(...bundle.academic);
  return sets;
}

export function readingItemIds(set: CompleteTheWordsSet | DailyLifeSet | AcademicSet): string[] {
  if (set.taskType === "complete_the_words") {
    return set.tokens.filter((t) => t.isGap && t.itemId).map((t) => t.itemId as string);
  }
  return set.questions.map((q) => q.id);
}

export function flattenListeningItems(bundle: ListeningBundle, scope: ScopePart[]) {
  const items: Array<
    | { kind: "choose"; item: ListeningBundle["choose"][number] }
    | { kind: "set"; item: SpokenSet }
  > = [];
  if (taskEnabled(scope, "listening", "listen_choose_response")) {
    for (const item of bundle.choose) items.push({ kind: "choose", item });
  }
  if (taskEnabled(scope, "listening", "listen_conversation")) {
    for (const item of bundle.conversations) items.push({ kind: "set", item });
  }
  if (taskEnabled(scope, "listening", "listen_announcement")) {
    for (const item of bundle.announcements) items.push({ kind: "set", item });
  }
  if (taskEnabled(scope, "listening", "listen_academic_talk")) {
    for (const item of bundle.talks) items.push({ kind: "set", item });
  }
  return items;
}

export function listeningQuestionIds(
  entry:
    | { kind: "choose"; item: ListeningBundle["choose"][number] }
    | { kind: "set"; item: SpokenSet },
): string[] {
  if (entry.kind === "choose") return [entry.item.id];
  return entry.item.questions.map((q) => q.id);
}

export function speakingRepeatItems(form: TestFormPayload, scope: ScopePart[]): RepeatItem[] {
  if (!taskEnabled(scope, "speaking", "listen_repeat")) return [];
  return form.speaking.listenRepeat.items;
}

export function speakingInterviewItems(form: TestFormPayload, scope: ScopePart[]) {
  if (!taskEnabled(scope, "speaking", "take_interview")) return [];
  return form.speaking.interview.items;
}

export function countReadingItems(bundle: ReadingBundle, scope: ScopePart[]): number {
  return flattenReadingSets(bundle, scope).reduce((n, set) => n + readingItemIds(set).length, 0);
}

export function countListeningItems(bundle: ListeningBundle, scope: ScopePart[]): number {
  return flattenListeningItems(bundle, scope).reduce((n, entry) => n + listeningQuestionIds(entry).length, 0);
}

export function pointerTitle(pointer: Pointer): string {
  const map: Record<Pointer, string> = {
    checkin: "Check-in",
    "directions:reading": "Reading directions",
    "reading:m1": "Reading — Module 1",
    "reading:review-m1": "Reading — Module 1 review",
    "reading:m2": "Reading — Module 2",
    "reading:review-m2": "Reading — Module 2 review",
    "directions:listening": "Listening directions",
    "listening:m1": "Listening — Module 1",
    "listening:m2": "Listening — Module 2",
    "directions:writing": "Writing directions",
    "writing:sentences": "Writing — Build a Sentence",
    "writing:email": "Writing — Email",
    "writing:discussion": "Writing — Academic Discussion",
    "directions:speaking": "Speaking directions",
    "speaking:check": "Microphone check",
    "speaking:repeat": "Speaking — Listen and Repeat",
    "speaking:interview": "Speaking — Interview",
    scoring: "Scoring",
    completed: "Completed",
  };
  return map[pointer];
}

export function taskLabel(task: TaskType): string {
  const map: Record<TaskType, string> = {
    complete_the_words: "Complete the Words",
    read_daily_life: "Read in Daily Life",
    read_academic: "Read an Academic Passage",
    listen_choose_response: "Listen and Choose a Response",
    listen_conversation: "Listen to a Conversation",
    listen_announcement: "Listen to an Announcement",
    listen_academic_talk: "Listen to an Academic Talk",
    build_sentence: "Build a Sentence",
    write_email: "Write an Email",
    write_discussion: "Write for an Academic Discussion",
    listen_repeat: "Listen and Repeat",
    take_interview: "Take an Interview",
  };
  return map[task];
}
