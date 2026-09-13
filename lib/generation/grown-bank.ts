import fs from "fs";
import path from "path";
import { DATA_DIR } from "../paths";
import { emptyGrownBank, type GrownBank } from "./seeds";
import { contentKey } from "./content-key";

const BANK_PATH = path.join(DATA_DIR, "item-bank.json");

const CAPS: Record<keyof Omit<GrownBank, "version">, number> = {
  ctw: 80,
  daily: 80,
  academic: 40,
  choose: 160,
  conversations: 48,
  announcements: 40,
  talks: 40,
  sentences: 80,
  emails: 40,
  discussions: 40,
  repeats: 20,
  interviews: 20,
};

export function fingerprint(value: string): string {
  return contentKey(value).slice(0, 96);
}

export function seedKey(kind: keyof Omit<GrownBank, "version">, item: unknown): string {
  const row = item as Record<string, unknown>;
  if (kind === "ctw") return contentKey(String(row.text || ""));
  if (kind === "choose") {
    const audio = row.audio as { script?: string } | undefined;
    return contentKey(String(row.script || audio?.script || ""));
  }
  if (kind === "sentences") return contentKey(String(row.exchange || ""));
  if (kind === "emails") return contentKey(String(row.scenario || ""));
  if (kind === "discussions") return contentKey(String(row.prompt || row.course || ""));
  if (kind === "repeats" || kind === "interviews") return contentKey(String(row.scenario || ""));
  if (kind === "conversations" || kind === "announcements" || kind === "talks") {
    const script = Array.isArray(row.script)
      ? row.script.map((line) => (line as { text?: string }).text || "").join(" ")
      : "";
    return contentKey(script || String(row.title || ""));
  }
  return contentKey(String(row.text || row.title || ""));
}

export function loadGrownBank(): GrownBank {
  try {
    if (!fs.existsSync(BANK_PATH)) return emptyGrownBank();
    const raw = JSON.parse(fs.readFileSync(BANK_PATH, "utf8")) as Partial<GrownBank>;
    const empty = emptyGrownBank();
    return {
      ...empty,
      ...raw,
      version: 1,
      emails: raw.emails || [],
      discussions: raw.discussions || [],
    };
  } catch {
    return emptyGrownBank();
  }
}

function appendUnique<T>(current: T[], incoming: T[] | undefined, cap: number, kind: keyof typeof CAPS): T[] {
  const seen = new Set(current.map((item) => seedKey(kind, item)));
  const added = (incoming || []).filter((item) => {
    const key = seedKey(kind, item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...current, ...added].slice(-cap);
}

export function mergeGrownBank(base: GrownBank, incoming: Partial<GrownBank>): GrownBank {
  return {
    version: 1,
    ctw: appendUnique(base.ctw, incoming.ctw, CAPS.ctw, "ctw"),
    daily: appendUnique(base.daily, incoming.daily, CAPS.daily, "daily"),
    academic: appendUnique(base.academic, incoming.academic, CAPS.academic, "academic"),
    choose: appendUnique(base.choose, incoming.choose, CAPS.choose, "choose"),
    conversations: appendUnique(base.conversations, incoming.conversations, CAPS.conversations, "conversations"),
    announcements: appendUnique(base.announcements, incoming.announcements, CAPS.announcements, "announcements"),
    talks: appendUnique(base.talks, incoming.talks, CAPS.talks, "talks"),
    sentences: appendUnique(base.sentences, incoming.sentences, CAPS.sentences, "sentences"),
    emails: appendUnique(base.emails, incoming.emails, CAPS.emails, "emails"),
    discussions: appendUnique(base.discussions, incoming.discussions, CAPS.discussions, "discussions"),
    repeats: appendUnique(base.repeats, incoming.repeats, CAPS.repeats, "repeats"),
    interviews: appendUnique(base.interviews, incoming.interviews, CAPS.interviews, "interviews"),
  };
}

export function saveGrownBank(bank: GrownBank): GrownBank {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BANK_PATH, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  return bank;
}

export function appendGrownBank(incoming: Partial<GrownBank>): GrownBank {
  const merged = mergeGrownBank(loadGrownBank(), incoming);
  return saveGrownBank(merged);
}

export function grownBankSize(bank: GrownBank): number {
  return (
    bank.ctw.length +
    bank.daily.length +
    bank.academic.length +
    bank.choose.length +
    bank.conversations.length +
    bank.announcements.length +
    bank.talks.length +
    bank.sentences.length +
    bank.emails.length +
    bank.discussions.length +
    bank.repeats.length +
    bank.interviews.length
  );
}
