import { durationForPointer } from "./timing";
import type { Pointer, RouteLevel, ScopePart, TestFormPayload } from "./types";
import { speakingInterviewItems, speakingRepeatItems } from "./form";
import { sectionEnabled, taskEnabled } from "./scope";

const ORDER: Pointer[] = [
  "checkin",
  "directions:reading",
  "reading:m1",
  "reading:review-m1",
  "reading:m2",
  "reading:review-m2",
  "directions:listening",
  "listening:m1",
  "listening:m2",
  "directions:writing",
  "writing:sentences",
  "writing:email",
  "writing:discussion",
  "directions:speaking",
  "speaking:check",
  "speaking:repeat-intro",
  "speaking:repeat",
  "speaking:interview-intro",
  "speaking:interview",
  "scoring",
  "completed",
];

function pointerActive(
  pointer: Pointer,
  scope: ScopePart[],
  form: TestFormPayload,
): boolean {
  switch (pointer) {
    case "checkin":
    case "scoring":
    case "completed":
      return true;
    case "directions:reading":
    case "reading:m1":
    case "reading:review-m1":
    case "reading:m2":
    case "reading:review-m2":
      return sectionEnabled(scope, "reading");
    case "directions:listening":
    case "listening:m1":
    case "listening:m2":
      return sectionEnabled(scope, "listening");
    case "directions:writing":
      return sectionEnabled(scope, "writing");
    case "writing:sentences":
      return taskEnabled(scope, "writing", "build_sentence");
    case "writing:email":
      return taskEnabled(scope, "writing", "write_email");
    case "writing:discussion":
      return taskEnabled(scope, "writing", "write_discussion");
    case "directions:speaking":
    case "speaking:check":
      return sectionEnabled(scope, "speaking");
    case "speaking:repeat-intro":
    case "speaking:repeat":
      return speakingRepeatItems(form, scope).length > 0;
    case "speaking:interview-intro":
    case "speaking:interview":
      return speakingInterviewItems(form, scope).length > 0;
    default:
      return false;
  }
}

export function firstPointer(scope: ScopePart[], form: TestFormPayload): Pointer {
  return ORDER.find((p) => pointerActive(p, scope, form)) ?? "completed";
}

export function nextPointer(
  current: Pointer,
  scope: ScopePart[],
  form: TestFormPayload,
): Pointer {
  const idx = ORDER.indexOf(current);
  for (let i = idx + 1; i < ORDER.length; i++) {
    if (pointerActive(ORDER[i], scope, form)) return ORDER[i];
  }
  return "completed";
}

export function clockFor(
  pointer: Pointer,
  listeningRoute?: RouteLevel | null,
): { starts: boolean; ms: number | null } {
  const ms = durationForPointer(pointer, listeningRoute);
  const starts = ms !== null && !pointer.startsWith("reading:review");
  return { starts, ms };
}

export function isTimedPointer(pointer: Pointer): boolean {
  return durationForPointer(pointer) !== null;
}

export function allowsBack(pointer: Pointer): boolean {
  return (
    pointer === "reading:m1" ||
    pointer === "reading:m2" ||
    pointer === "reading:review-m1" ||
    pointer === "reading:review-m2" ||
    pointer === "writing:sentences"
  );
}

export { ORDER as POINTER_ORDER };
