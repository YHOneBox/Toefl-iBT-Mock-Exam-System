import type { Pointer, RouteLevel } from "./types";

export const TIMING_MS = {
  readingM1: 20 * 60 * 1000,
  readingM2: 9 * 60 * 1000,
  listeningM1: 18 * 60 * 1000,
  listeningM2Lower: 7 * 60 * 1000,
  listeningM2Upper: 11 * 60 * 1000,
  writingSentences: 6 * 60 * 1000,
  writingEmail: 7 * 60 * 1000,
  writingDiscussion: 10 * 60 * 1000,
} as const;

export function durationForPointer(pointer: Pointer, listeningRoute?: RouteLevel | null): number | null {
  switch (pointer) {
    case "reading:m1":
    case "reading:review-m1":
      return TIMING_MS.readingM1;
    case "reading:m2":
    case "reading:review-m2":
      return TIMING_MS.readingM2;
    case "listening:m1":
      return TIMING_MS.listeningM1;
    case "listening:m2":
      return listeningRoute === "upper" ? TIMING_MS.listeningM2Upper : TIMING_MS.listeningM2Lower;
    case "writing:sentences":
      return TIMING_MS.writingSentences;
    case "writing:email":
      return TIMING_MS.writingEmail;
    case "writing:discussion":
      return TIMING_MS.writingDiscussion;
    default:
      return null;
  }
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
