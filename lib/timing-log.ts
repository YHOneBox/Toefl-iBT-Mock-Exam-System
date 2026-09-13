import type { Pointer } from "./types";
import { TIMING_MS, formatClock } from "./timing";

export type SessionTiming = {
  parts: Record<string, { ms: number }>;
  items: Record<string, { ms: number }>;
};

export function emptyTiming(): SessionTiming {
  return { parts: {}, items: {} };
}

export function parseTiming(raw: unknown): SessionTiming {
  if (!raw || typeof raw !== "object") return emptyTiming();
  const value = raw as SessionTiming;
  return {
    parts: value.parts && typeof value.parts === "object" ? value.parts : {},
    items: value.items && typeof value.items === "object" ? value.items : {},
  };
}

export function addTime(timing: SessionTiming, part: string | null, itemId: string | null, ms: number): SessionTiming {
  if (ms < 250) return timing;
  const parts = { ...timing.parts };
  const items = { ...timing.items };
  if (part) parts[part] = { ms: (parts[part]?.ms || 0) + ms };
  if (itemId) items[itemId] = { ms: (items[itemId]?.ms || 0) + ms };
  return { parts, items };
}

export function formatSpent(ms?: number | null): string {
  if (ms == null || ms <= 0) return "—";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  return formatClock(ms);
}

export function partKey(pointer: Pointer): string | null {
  if (pointer === "reading:review-m1") return "reading:m1";
  if (pointer === "reading:review-m2") return "reading:m2";
  if (
    pointer.startsWith("reading:") ||
    pointer.startsWith("listening:") ||
    pointer.startsWith("writing:") ||
    pointer === "speaking:repeat" ||
    pointer === "speaking:interview"
  ) {
    return pointer;
  }
  return null;
}

export function partMs(timing: SessionTiming | null | undefined, keys: string[]): number {
  if (!timing?.parts) return 0;
  return keys.reduce((sum, key) => sum + (timing.parts[key]?.ms || 0), 0);
}

export function itemMs(timing: SessionTiming | null | undefined, id?: string | null): number | undefined {
  if (!timing?.items || !id) return undefined;
  const ms = timing.items[id]?.ms;
  return ms && ms > 0 ? ms : undefined;
}

export function officialLimit(part: string, listeningRoute?: string | null): number | null {
  switch (part) {
    case "reading:m1":
      return TIMING_MS.readingM1;
    case "reading:m2":
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
