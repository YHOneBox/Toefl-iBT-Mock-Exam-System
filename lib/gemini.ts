import { combineSignals } from "./abort";
import { geminiLimiter, type GeminiWaitInfo } from "./gemini-limiter";
import { getJsonSetting, getSetting, setSetting } from "./settings";

const GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 40_000;

export type GeminiModelInfo = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  methods: string[];
  recommended: boolean;
  reason: string;
};

export type GeminiSettings = {
  chain: string[];
  available: GeminiModelInfo[];
  scannedAt?: string | null;
  lastUsed?: string | null;
  lastError?: string | null;
};

const SKIP_RE = /embedding|imagen|[-_]image\b|veo|tts|audio|lyria|robotics|computer-use|image-generation|live/i;

export function stripModelPrefix(id: string): string {
  return id.replace(/^models\//, "");
}

export function isAppropriateGeminiModel(model: {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}): { ok: boolean; recommended: boolean; reason: string } {
  const id = stripModelPrefix(model.name || "");
  const methods = model.supportedGenerationMethods || [];
  if (!id) return { ok: false, recommended: false, reason: "Missing id" };
  if (!methods.includes("generateContent")) {
    return { ok: false, recommended: false, reason: "No generateContent support" };
  }
  if (!/gemini/i.test(id)) {
    return { ok: false, recommended: false, reason: "Not a Gemini text model" };
  }
  if (SKIP_RE.test(id) || SKIP_RE.test(model.displayName || "") || SKIP_RE.test(model.description || "")) {
    return { ok: false, recommended: false, reason: "Media, live, or embedding model" };
  }
  const recommended = /flash|pro/i.test(id) && !/exp|preview|thinking/i.test(id);
  return {
    ok: true,
    recommended,
    reason: recommended
      ? "Stable generateContent model, good for JSON items and scoring"
      : "Usable generateContent fallback",
  };
}

export function isTransientLlmError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|504|408|timeout|timed out|aborted|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate.?limit|deadline|overloaded|high demand|try again/i.test(
    msg,
  );
}

export async function listGeminiModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const models: GeminiModelInfo[] = [];
  let pageToken = "";
  for (let i = 0; i < 8; i++) {
    const url = new URL(`${GEMINI_ROOT}/models`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Gemini model list failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }>;
      nextPageToken?: string;
    };
    for (const model of data.models || []) {
      const verdict = isAppropriateGeminiModel(model);
      if (!verdict.ok) continue;
      const id = stripModelPrefix(model.name || "");
      models.push({
        id,
        name: model.name || `models/${id}`,
        displayName: model.displayName || id,
        description: model.description || "",
        methods: model.supportedGenerationMethods || [],
        recommended: verdict.recommended,
        reason: verdict.reason,
      });
    }
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  return models.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.displayName.localeCompare(b.displayName));
}

export function defaultGeminiChain(availableIds: string[] = []): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  const preferred = [
    env,
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
  ].filter((id): id is string => Boolean(id));
  const unique = [...new Set(preferred)];
  if (!availableIds.length) return unique;
  const known = unique.filter((id) => availableIds.includes(id));
  const extras = availableIds.filter((id) => !known.includes(id));
  return [...known, ...extras];
}

export async function loadGeminiSettings(): Promise<GeminiSettings> {
  const stored = await getJsonSetting<GeminiSettings>("gemini", { chain: [], available: [] });
  if (!stored.chain) stored.chain = [];
  if (!stored.available) stored.available = [];
  if (!stored.chain.length) {
    stored.chain = defaultGeminiChain(stored.available.map((m) => m.id));
  }
  return stored;
}

export async function saveGeminiAvailable(models: GeminiModelInfo[]): Promise<GeminiSettings> {
  const current = await loadGeminiSettings();
  const ids = new Set(models.map((m) => m.id));
  const chain = current.chain.filter((id) => ids.has(id));
  const next: GeminiSettings = {
    ...current,
    available: models,
    scannedAt: new Date().toISOString(),
    chain: chain.length ? chain : defaultGeminiChain(models.filter((m) => m.recommended).map((m) => m.id)),
  };
  await setSetting("gemini", JSON.stringify(next));
  return next;
}

export async function saveGeminiChain(chain: string[]): Promise<GeminiSettings> {
  const current = await loadGeminiSettings();
  const next: GeminiSettings = {
    ...current,
    chain: [...new Set(chain.map(stripModelPrefix).filter(Boolean))],
    lastError: null,
  };
  await setSetting("gemini", JSON.stringify(next));
  return next;
}

export async function rememberGeminiUse(model: string, error?: string) {
  const current = await loadGeminiSettings();
  current.lastUsed = model;
  current.lastError = error || null;
  await setSetting("gemini", JSON.stringify(current));
  if (model) await setSetting("geminiLastUsed", model);
}

export async function callGeminiGenerateJson(opts: {
  system: string;
  user: string;
  temperature?: number;
  model: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  onWait?: (info: GeminiWaitInfo) => void;
}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const model = stripModelPrefix(opts.model);
  await geminiLimiter.waitFor(model, opts.signal, opts.onWait);
  const url = `${GEMINI_ROOT}/models/${model}:generateContent?key=${key}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: combineSignals(opts.signal, AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system || "Return valid JSON only." }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.signal?.aborted) throw new Error("Preparation was stopped.");
    if (/abort|timeout/i.test(msg)) throw new Error(`Gemini timeout on ${model}`);
    throw err;
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(body)) {
      throw new Error(`Gemini ${res.status} (${model}): ${body}`);
    }
    throw new Error(`Gemini ${res.status} (${model}): ${body}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
  return extractJson(text);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start =
    raw.indexOf("{") >= 0 && (raw.indexOf("[") < 0 || raw.indexOf("{") < raw.indexOf("["))
      ? raw.indexOf("{")
      : raw.indexOf("[");
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start < 0 || end < 0) throw new Error("Model did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}
