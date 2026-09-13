export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g);
  if (!parts?.length) return text.trim() ? [text.trim()] : [];
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function defaultInsertPositions(sentenceCount: number): number[] {
  if (sentenceCount <= 1) return [0, 0, 0, 0];
  if (sentenceCount === 2) return [0, 0, 1, 1];
  if (sentenceCount === 3) return [0, 1, 2, 2];
  if (sentenceCount === 4) return [0, 1, 2, 3];
  const last = sentenceCount - 1;
  const step = last / 3;
  const raw = [0, Math.round(step), Math.round(step * 2), last];
  const unique: number[] = [];
  for (const index of raw) {
    const clamped = Math.max(0, Math.min(last, index));
    if (!unique.includes(clamped)) unique.push(clamped);
  }
  let fill = 0;
  while (unique.length < 4 && fill <= last) {
    if (!unique.includes(fill)) unique.push(fill);
    fill += 1;
  }
  return unique.slice(0, 4);
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
