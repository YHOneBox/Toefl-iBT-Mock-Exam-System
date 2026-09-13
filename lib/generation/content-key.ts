import { normalizeText } from "../passage";

/** Full normalized text. Used for uniqueness and seen history. */
export function contentKey(value: string): string {
  return normalizeText(value);
}

/** Legacy 96-character fingerprint. Older seen-items.json rows use this. */
export function clipKey(value: string): string {
  return contentKey(value).slice(0, 96);
}

export function spokenJoinKey(script: Array<{ text?: string } | string>): string {
  return contentKey(
    script
      .map((line) => (typeof line === "string" ? line : line.text || ""))
      .join(" "),
  );
}

export function spokenLineKeys(script: Array<{ text?: string } | string>): string[] {
  return script
    .map((line) => contentKey(typeof line === "string" ? line : line.text || ""))
    .filter(Boolean);
}

export function spokenAudioKeys(script: Array<{ text?: string } | string>): string[] {
  return [...new Set([spokenJoinKey(script), ...spokenLineKeys(script)].filter(Boolean))];
}

/**
 * Match a full content key against the seen store.
 * Accepts exact keys, legacy 96-char clips, and prefix overlap of at least 48 characters
 * so older fingerprints still block the same passage or script.
 */
export function isSeenKey(seen: Set<string>, full: string): boolean {
  if (!full) return false;
  if (seen.has(full)) return true;
  const clip = full.slice(0, 96);
  if (clip && seen.has(clip)) return true;
  for (const key of seen) {
    if (key.length < 48) continue;
    if (full.startsWith(key) || (full.length >= 48 && key.startsWith(full))) return true;
  }
  return false;
}

export function isSeenText(seen: Set<string>, value: string): boolean {
  return isSeenKey(seen, contentKey(value));
}

export function rememberKeysForText(value: string): string[] {
  const full = contentKey(value);
  if (!full) return [];
  if (full.length <= 96) return [full];
  return [full, full.slice(0, 96)];
}
