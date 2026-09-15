import { sleep, throwIfAborted } from "./abort";
import type { GeminiKeySlot } from "./gemini-keys";
import { getJsonSetting, setSetting } from "./settings";

export type GeminiWaitInfo = {
  waitMs: number;
  reason: string;
  model?: string;
  keySlot?: GeminiKeySlot;
};

/** Stay under typical Gemini free/tier Flash caps (5 RPM, lite 10–15 RPM, 20 RPD). */
const GLOBAL_MIN_GAP_MS = Number(process.env.GEMINI_MIN_GAP_MS || 4_000);
const RPM_COOLDOWN_MS = 75_000;
const RPD_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_SETTING = "geminiCooldown";
/** Cooldowns longer than this are treated as daily caps: skip to the next model in the user's order. */
const SKIP_COOLDOWN_MS = 2 * 60 * 1000;
const KEY_MARK = "__key__";

function rpmBudget(model: string): number {
  const env = Number(process.env.GEMINI_MAX_RPM || 0);
  if (env > 0) return env;
  const id = model.toLowerCase();
  if (id.includes("lite")) return 8;
  if (id.includes("pro")) return 2;
  return 4;
}

function gapFor(model: string): number {
  return Math.ceil(60_000 / rpmBudget(model)) + 750;
}

function ns(slot: GeminiKeySlot, model: string) {
  return `${slot}::${model}`;
}

function parseStoredId(id: string): { slot: GeminiKeySlot; model: string } {
  const sep = id.indexOf("::");
  if (sep > 0) {
    const slot = id.slice(0, sep);
    if (slot === "primary" || slot === "fallback") {
      return { slot, model: id.slice(sep + 2) };
    }
  }
  return { slot: "primary", model: id };
}

export function isDailyQuotaError(message: string): boolean {
  const daily = /GenerateRequestsPerDay|RequestsPerDayPerProject|PerDayPerProjectPerModel|per day per project/i.test(
    message,
  );
  const perMinute = /GenerateRequestsPerMinute|RequestsPerMinute|PerMinutePerProject/i.test(message);
  return daily && !perMinute;
}

/** Whole-key / project daily cap — switch to GEMINI_API_KEY_FALLBACK instead of the next model. */
export function isProjectQuotaError(message: string): boolean {
  if (/GenerateRequestsPerMinute|RequestsPerMinute|PerMinutePerProject/i.test(message)) return false;
  if (/PerDayPerProjectPerModel|GenerateRequestsPerDayPerModel|PerModel/i.test(message)) return false;
  return /RequestsPerDayPerProject|PerProjectPerDay/i.test(message);
}

export function retryAfterMs(message: string): number {
  if (isProjectQuotaError(message) || isDailyQuotaError(message)) return RPD_COOLDOWN_MS;
  const delay = message.match(/retryDelay["':\s]+"?(\d+(?:\.\d+)?)s/i);
  if (delay) return Math.min(90_000, Math.round((Number(delay[1]) + 1) * 1000));
  const after = message.match(/retry[- ]after["':\s]+(\d+)/i);
  if (after) return Math.min(90_000, Number(after[1]) * 1000);
  return RPM_COOLDOWN_MS;
}

export function uniqueModelChain(chain: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of chain) {
    const model = id.trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

class GeminiLimiter {
  private tail = Promise.resolve();
  private lastAny = 0;
  private lastByModel = new Map<string, number>();
  private coolUntil = new Map<string, number>();
  private hydrated = false;

  async hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    const stored = await getJsonSetting<Record<string, number>>(COOLDOWN_SETTING, {});
    const now = Date.now();
    for (const [rawId, until] of Object.entries(stored)) {
      if (typeof until !== "number" || until <= now) continue;
      const { slot, model } = parseStoredId(rawId);
      this.coolUntil.set(ns(slot, model), until);
    }
  }

  private persist() {
    const now = Date.now();
    const payload: Record<string, number> = {};
    for (const [id, until] of this.coolUntil) {
      if (until > now) payload[id] = until;
    }
    void setSetting(COOLDOWN_SETTING, JSON.stringify(payload));
  }

  coolRemaining(model: string, slot: GeminiKeySlot = "primary") {
    return Math.max(0, (this.coolUntil.get(ns(slot, model)) || 0) - Date.now());
  }

  isCooling(model: string, slot: GeminiKeySlot = "primary") {
    return this.coolRemaining(model, slot) > 0;
  }

  /** Daily / long cooldowns should skip this model and use the next one in the user's list. */
  shouldSkip(model: string, slot: GeminiKeySlot = "primary") {
    return this.coolRemaining(model, slot) > SKIP_COOLDOWN_MS;
  }

  keyRemaining(slot: GeminiKeySlot) {
    return this.coolRemaining(KEY_MARK, slot);
  }

  shouldSkipKey(slot: GeminiKeySlot) {
    return this.keyRemaining(slot) > SKIP_COOLDOWN_MS;
  }

  allModelsSkipped(chain: string[], slot: GeminiKeySlot) {
    return chain.length > 0 && chain.every((model) => this.shouldSkip(model, slot));
  }

  noteLimited(model: string, waitMs = RPM_COOLDOWN_MS, slot: GeminiKeySlot = "primary") {
    const until = Date.now() + Math.max(waitMs, 20_000);
    const id = ns(slot, model);
    const prev = this.coolUntil.get(id) || 0;
    this.coolUntil.set(id, Math.max(prev, until));
    this.persist();
  }

  noteKeyLimited(slot: GeminiKeySlot, waitMs = RPD_COOLDOWN_MS) {
    this.noteLimited(KEY_MARK, waitMs, slot);
  }

  async waitFor(
    model: string,
    signal?: AbortSignal,
    onWait?: (info: GeminiWaitInfo) => void,
    slot: GeminiKeySlot = "primary",
  ) {
    const run = this.tail.then(async () => {
      throwIfAborted(signal);
      const now = Date.now();
      const modelId = ns(slot, model);
      const wait = Math.max(
        0,
        GLOBAL_MIN_GAP_MS - (now - this.lastAny),
        gapFor(model) - (now - (this.lastByModel.get(modelId) || 0)),
      );
      if (wait > 200) {
        onWait?.({
          waitMs: wait,
          model,
          keySlot: slot,
          reason: `Waiting ${Math.ceil(wait / 1000)}s so ${model} stays under its per-minute limit`,
        });
        await sleep(wait, signal);
      }
      const stamped = Date.now();
      this.lastAny = stamped;
      this.lastByModel.set(modelId, stamped);
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }
}

export const geminiLimiter = new GeminiLimiter();
