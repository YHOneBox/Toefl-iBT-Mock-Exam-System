export type GeminiKeySlot = "primary" | "fallback";

export type GeminiKey = {
  slot: GeminiKeySlot;
  key: string;
  label: string;
};

function trimKey(value?: string) {
  const key = value?.trim();
  return key || "";
}

export function geminiKeys(): GeminiKey[] {
  const keys: GeminiKey[] = [];
  const primary = trimKey(process.env.GEMINI_API_KEY);
  const fallback = trimKey(process.env.GEMINI_API_KEY_FALLBACK);
  if (primary) keys.push({ slot: "primary", key: primary, label: "primary Gemini key" });
  if (fallback && fallback !== primary) {
    keys.push({ slot: "fallback", key: fallback, label: "fallback Gemini key" });
  }
  return keys;
}

export function hasGeminiKey() {
  return geminiKeys().length > 0;
}

export function geminiKeyPresence() {
  return {
    primary: Boolean(trimKey(process.env.GEMINI_API_KEY)),
    fallback: Boolean(trimKey(process.env.GEMINI_API_KEY_FALLBACK)),
  };
}
