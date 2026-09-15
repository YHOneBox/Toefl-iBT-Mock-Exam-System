import { combineSignals, sleep } from "./abort";
import { loadConstraintPack } from "./constraints";
import {
  callGeminiGenerateJson,
  isTransientLlmError,
  loadGeminiSettings,
  rememberGeminiUse,
} from "./gemini";
import { geminiKeys, hasGeminiKey } from "./gemini-keys";
import {
  geminiLimiter,
  isDailyQuotaError,
  isProjectQuotaError,
  retryAfterMs,
  uniqueModelChain,
  type GeminiWaitInfo,
} from "./gemini-limiter";

export type LlmJsonOptions = {
  system?: string;
  user: string;
  temperature?: number;
  signal?: AbortSignal;
  onWait?: (info: GeminiWaitInfo) => void;
  userId?: string;
  timeoutMs?: number;
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
  const keys = geminiKeys();
  if (!keys.length) throw new Error("GEMINI_API_KEY missing");
  await geminiLimiter.hydrate();
  const settings = await loadGeminiSettings(opts.userId);
  const rawChain = settings.chain.length ? settings.chain : [process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"];
  const chain = uniqueModelChain(rawChain);
  const errors: string[] = [];

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const entry = keys[keyIndex];
    if (geminiLimiter.shouldSkipKey(entry.slot)) {
      const remaining = geminiLimiter.keyRemaining(entry.slot);
      errors.push(`${entry.label}: AI Studio daily cooldown (${Math.ceil(remaining / 60000)} min left)`);
      if (keys[keyIndex + 1]) {
        opts.onWait?.({
          waitMs: 0,
          keySlot: entry.slot,
          reason: `${entry.label} is at its AI Studio daily limit; switching to the ${keys[keyIndex + 1].label}`,
        });
      }
      continue;
    }
    if (geminiLimiter.allModelsSkipped(chain, entry.slot)) {
      geminiLimiter.noteKeyLimited(entry.slot);
      errors.push(`${entry.label}: every model in your order is on a daily cap`);
      if (keys[keyIndex + 1]) {
        opts.onWait?.({
          waitMs: 0,
          keySlot: entry.slot,
          reason: `${entry.label} has no remaining Gemini quota; switching to the ${keys[keyIndex + 1].label}`,
        });
      }
      continue;
    }
    if (keyIndex > 0) {
      opts.onWait?.({
        waitMs: 0,
        keySlot: entry.slot,
        reason: `Using the ${entry.label} because the previous Gemini key hit its AI Studio limit`,
      });
    }

    for (let index = 0; index < chain.length; index += 1) {
      const model = chain[index];
      const place = `${index + 1} of ${chain.length} in your order`;
      if (geminiLimiter.shouldSkip(model, entry.slot)) {
        const remaining = geminiLimiter.coolRemaining(model, entry.slot);
        errors.push(`${entry.label} ${model}: daily-cap cooldown (${Math.ceil(remaining / 60000)} min left)`);
        opts.onWait?.({
          waitMs: remaining,
          model,
          keySlot: entry.slot,
          reason: `${model} is on a daily-cap cooldown on the ${entry.label}; trying the next model (${place})`,
        });
        continue;
      }
      const coolMs = geminiLimiter.coolRemaining(model, entry.slot);
      if (coolMs > 200) {
        opts.onWait?.({
          waitMs: coolMs,
          model,
          keySlot: entry.slot,
          reason: `Waiting ${Math.ceil(coolMs / 1000)}s for ${model} (${place}) to leave its per-minute cooldown`,
        });
        await sleep(coolMs, opts.signal);
      }
      const tryOnce = async () => {
        opts.onWait?.({
          waitMs: 0,
          model,
          keySlot: entry.slot,
          reason: `Calling ${model} (${place}) with the ${entry.label}`,
        });
        const result = await callGeminiGenerateJson({
          system: opts.system,
          user: opts.user,
          temperature: opts.temperature,
          model,
          timeoutMs: opts.timeoutMs,
          signal: opts.signal,
          onWait: opts.onWait,
          apiKey: entry.key,
          slot: entry.slot,
        });
        await rememberGeminiUse(model, undefined, opts.userId);
        return result;
      };
      try {
        return await tryOnce();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${entry.label} ${model}: ${message}`);
        await rememberGeminiUse(model, message, opts.userId);
        if (/401|403|API_KEY|invalid.*key/i.test(message)) {
          geminiLimiter.noteKeyLimited(entry.slot, 30 * 60 * 1000);
          opts.onWait?.({
            waitMs: 0,
            model,
            keySlot: entry.slot,
            reason: `${entry.label} was rejected; ${keys[keyIndex + 1] ? `switching to the ${keys[keyIndex + 1].label}` : "no more Gemini keys"}`,
          });
          break;
        }
        if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message)) {
          const waitMs = retryAfterMs(message);
          if (isProjectQuotaError(message)) {
            geminiLimiter.noteKeyLimited(entry.slot, waitMs);
            opts.onWait?.({
              waitMs,
              model,
              keySlot: entry.slot,
              reason: `${entry.label} hit its AI Studio project limit; ${keys[keyIndex + 1] ? `switching to the ${keys[keyIndex + 1].label}` : "no more Gemini keys"}`,
            });
            break;
          }
          geminiLimiter.noteLimited(model, waitMs, entry.slot);
          if (isDailyQuotaError(message) || waitMs > 120_000) {
            opts.onWait?.({
              waitMs,
              model,
              keySlot: entry.slot,
              reason: `${model} hit its daily cap on the ${entry.label}; trying the next model in your order`,
            });
            continue;
          }
          opts.onWait?.({
            waitMs,
            model,
            keySlot: entry.slot,
            reason: `${model} hit its per-minute limit; waiting ${Math.ceil(waitMs / 1000)}s then retrying it before the next model`,
          });
          try {
            await sleep(waitMs, opts.signal);
            return await tryOnce();
          } catch (retryErr) {
            const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
            errors.push(`${entry.label} ${model} retry: ${retryMessage}`);
            await rememberGeminiUse(model, retryMessage, opts.userId);
            if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(retryMessage)) {
              const retryWait = retryAfterMs(retryMessage);
              if (isProjectQuotaError(retryMessage)) {
                geminiLimiter.noteKeyLimited(entry.slot, retryWait);
                break;
              }
              geminiLimiter.noteLimited(model, retryWait, entry.slot);
            }
            continue;
          }
        }
        if (/404|not found|NOT_FOUND|not supported/i.test(message) || isTransientLlmError(err)) {
          opts.onWait?.({
            waitMs: 0,
            model,
            keySlot: entry.slot,
            reason: `${model} failed (${message.slice(0, 80)}); trying the next model in your order`,
          });
          continue;
        }
        throw err;
      }
    }

    if (geminiLimiter.allModelsSkipped(chain, entry.slot) && keys[keyIndex + 1]) {
      geminiLimiter.noteKeyLimited(entry.slot);
      opts.onWait?.({
        waitMs: 0,
        keySlot: entry.slot,
        reason: `${entry.label} has no remaining model quota; switching to the ${keys[keyIndex + 1].label}`,
      });
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
    signal: combineSignals(opts.signal, AbortSignal.timeout(40_000)),
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
  return hasGeminiKey() || Boolean(process.env.OPENAI_API_KEY);
}

export async function generateJson(opts: LlmJsonOptions): Promise<unknown> {
  const system = `${opts.system || "You generate original TOEFL iBT practice items."}\n\n${loadConstraintPack()}`;
  const payload = { ...opts, system };
  const errors: string[] = [];
  if (hasGeminiKey()) {
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
