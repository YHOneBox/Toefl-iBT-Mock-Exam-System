import { sleep, throwIfAborted } from "./abort";
import { getJsonSetting, setSetting } from "./settings";

export type GeminiWaitInfo = { waitMs: number; reason: string; model?: string };

/** Stay under typical Gemini free/tier Flash caps (5 RPM, lite 10–15 RPM, 20 RPD). */
const GLOBAL_MIN_GAP_MS = Number(process.env.GEMINI_MIN_GAP_MS || 4_000);
const RPM_COOLDOWN_MS = 75_000;
const RPD_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_SETTING = "geminiCooldown";

const QUOTA_FIRST = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

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

export function isDailyQuotaError(message: string): boolean {
  const daily = /GenerateRequestsPerDay|RequestsPerDayPerProject|PerDayPerProjectPerModel|per day per project/i.test(
    message,
  );
  const perMinute = /GenerateRequestsPerMinute|RequestsPerMinute|PerMinutePerProject/i.test(message);
  return daily && !perMinute;
}

export function retryAfterMs(message: string): number {
  if (isDailyQuotaError(message)) return RPD_COOLDOWN_MS;
  const delay = message.match(/retryDelay["':\s]+"?(\d+(?:\.\d+)?)s/i);
  if (delay) return Math.min(90_000, Math.round((Number(delay[1]) + 1) * 1000));
  const after = message.match(/retry[- ]after["':\s]+(\d+)/i);
  if (after) return Math.min(90_000, Number(after[1]) * 1000);
  return RPM_COOLDOWN_MS;
}

/** Prefer unused 2.5 / 2.0 quota before 3.x Flash models that are often at 5 RPM / 20 RPD. */
export function quotaAwareChain(chain: string[], availableIds: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (id: string) => {
    const model = id.trim();
    if (!model || seen.has(model)) return;
    seen.add(model);
    out.push(model);
  };
  const extras = QUOTA_FIRST.filter(
    (id) => chain.includes(id) || !availableIds.length || availableIds.includes(id),
  );
  for (const id of extras) add(id);
  for (const id of chain) {
    if (/2\.\d/.test(id) && /lite/i.test(id)) add(id);
  }
  for (const id of chain) {
    if (/2\.\d/.test(id)) add(id);
  }
  for (const id of chain) add(id);
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
    for (const [model, until] of Object.entries(stored)) {
      if (typeof until === "number" && until > now) this.coolUntil.set(model, until);
    }
  }

  private persist() {
    const now = Date.now();
    const payload: Record<string, number> = {};
    for (const [model, until] of this.coolUntil) {
      if (until > now) payload[model] = until;
    }
    void setSetting(COOLDOWN_SETTING, JSON.stringify(payload));
  }

  isCooling(model: string) {
    return Date.now() < (this.coolUntil.get(model) || 0);
  }

  readyFirst(chain: string[]): string[] {
    const now = Date.now();
    return [...chain].sort(
      (a, b) =>
        Number(this.isCooling(a)) - Number(this.isCooling(b)) ||
        (this.coolUntil.get(a) || 0) - (this.coolUntil.get(b) || now),
    );
  }

  noteLimited(model: string, waitMs = RPM_COOLDOWN_MS) {
    const until = Date.now() + Math.max(waitMs, 20_000);
    const prev = this.coolUntil.get(model) || 0;
    this.coolUntil.set(model, Math.max(prev, until));
    this.persist();
  }

  async waitFor(
    model: string,
    signal?: AbortSignal,
    onWait?: (info: GeminiWaitInfo) => void,
  ) {
    const run = this.tail.then(async () => {
      throwIfAborted(signal);
      const now = Date.now();
      const wait = Math.max(
        0,
        GLOBAL_MIN_GAP_MS - (now - this.lastAny),
        gapFor(model) - (now - (this.lastByModel.get(model) || 0)),
      );
      if (wait > 200) {
        onWait?.({
          waitMs: wait,
          model,
          reason: `Waiting ${Math.ceil(wait / 1000)}s so ${model} stays under its per-minute limit`,
        });
        await sleep(wait, signal);
      }
      const stamped = Date.now();
      this.lastAny = stamped;
      this.lastByModel.set(model, stamped);
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }
}

export const geminiLimiter = new GeminiLimiter();
