import { TASK_TYPES, type ScopePart, type SectionName, type TaskType } from "./types";

export function parseScope(scopeJson: string): ScopePart[] {
  try {
    const parsed = JSON.parse(scopeJson) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ScopePart[];
  } catch {
    /* ignore */
  }
  return ["full"];
}

export function isFullScope(scope: ScopePart[]): boolean {
  return scope.includes("full") || scope.length === 0;
}

export function sectionEnabled(scope: ScopePart[], section: SectionName): boolean {
  if (isFullScope(scope)) return true;
  return scope.some((part) => part === section || part.startsWith(`${section}:`));
}

export function taskEnabled(scope: ScopePart[], section: SectionName, task: TaskType): boolean {
  if (isFullScope(scope)) return true;
  if (scope.includes(section)) return true;
  return scope.includes(`${section}:${task}`);
}

export function enabledSections(scope: ScopePart[]): SectionName[] {
  return (["reading", "listening", "writing", "speaking"] as SectionName[]).filter((s) =>
    sectionEnabled(scope, s),
  );
}

export function describeScope(scope: ScopePart[]): string {
  if (isFullScope(scope)) return "Full test";
  return scope
    .map((part) =>
      part
        .split(":")
        .map((bit) => bit.replaceAll("_", " "))
        .join(" · "),
    )
    .join(", ");
}

export function allScopeOptions(): Array<{ id: ScopePart; label: string; group: string }> {
  return [
    { id: "reading", label: "Reading (full section)", group: "Reading" },
    { id: "reading:complete_the_words", label: "Complete the Words", group: "Reading" },
    { id: "reading:read_daily_life", label: "Read in Daily Life", group: "Reading" },
    { id: "reading:read_academic", label: "Read an Academic Passage", group: "Reading" },
    { id: "listening", label: "Listening (full section)", group: "Listening" },
    { id: "listening:listen_choose_response", label: "Listen and Choose a Response", group: "Listening" },
    { id: "listening:listen_conversation", label: "Listen to a Conversation", group: "Listening" },
    { id: "listening:listen_announcement", label: "Listen to an Announcement", group: "Listening" },
    { id: "listening:listen_academic_talk", label: "Listen to an Academic Talk", group: "Listening" },
    { id: "writing", label: "Writing (full section)", group: "Writing" },
    { id: "writing:build_sentence", label: "Build a Sentence", group: "Writing" },
    { id: "writing:write_email", label: "Write an Email", group: "Writing" },
    { id: "writing:write_discussion", label: "Academic Discussion", group: "Writing" },
    { id: "speaking", label: "Speaking (full section)", group: "Speaking" },
    { id: "speaking:listen_repeat", label: "Listen and Repeat", group: "Speaking" },
    { id: "speaking:take_interview", label: "Take an Interview", group: "Speaking" },
  ];
}

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}
