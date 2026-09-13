import { loadConstraintPack } from "./constraints";
import {
  callGeminiGenerateJson,
  isTransientLlmError,
  loadGeminiSettings,
  rememberGeminiUse,
} from "./gemini";

export type LlmJsonOptions = {
  system?: string;
  user: string;
  temperature?: number;
};

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

async function geminiJsonWithFallback(opts: LlmJsonOptions & { system: string }): Promise<unknown> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const settings = await loadGeminiSettings();
  const chain = settings.chain.length ? settings.chain : [process.env.GEMINI_MODEL || "gemini-2.0-flash"];
  const errors: string[] = [];
  for (const model of chain) {
    try {
      const result = await callGeminiGenerateJson({
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature,
        model,
      });
      await rememberGeminiUse(model);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${message}`);
      await rememberGeminiUse(model, message);
      if (!isTransientLlmError(err) && !/404|not found|NOT_FOUND|not supported/i.test(message)) {
        if (/401|403|API_KEY|invalid.*key/i.test(message)) break;
        continue;
      }
    }
  }
  throw new Error(errors.join(" | ") || "All Gemini models failed");
}

async function openaiJson(opts: LlmJsonOptions): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(40_000),
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system || "Return valid JSON only." },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return extractJson(data.choices?.[0]?.message?.content || "");
}

export function hasLlmKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

export async function generateJson(opts: LlmJsonOptions): Promise<unknown> {
  const system = `${opts.system || "You generate original TOEFL iBT practice items."}\n\n${loadConstraintPack()}`;
  const payload = { ...opts, system };
  const errors: string[] = [];
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiJsonWithFallback(payload);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiJson(payload);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(errors[0] || "No LLM API key configured");
}

export async function scoreWithLlm(user: string): Promise<unknown> {
  return generateJson({
    system:
      "You are a careful TOEFL rater. Follow the rubrics. Return JSON only with keys: score (0-5 integer), traits (object), evidence (string array), how_to_improve (string).",
    user,
    temperature: 0.2,
  });
}
