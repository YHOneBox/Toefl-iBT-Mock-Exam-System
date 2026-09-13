import fs from "fs";
import path from "path";
import { prisma } from "../db";
import { DATA_DIR } from "../paths";
import type { TestFormPayload } from "../types";
import { fingerprint, seedKey } from "./grown-bank";

const HISTORY_PATH = path.join(DATA_DIR, "seen-items.json");

type HistoryFile = {
  version: 1;
  users: Record<string, { keys: string[]; labels: string[] }>;
};

function emptyFile(): HistoryFile {
  return { version: 1, users: {} };
}

function loadFile(): HistoryFile {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return emptyFile();
    const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as HistoryFile;
    return { version: 1, users: raw.users || {} };
  } catch {
    return emptyFile();
  }
}

function saveFile(file: HistoryFile) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function fingerprintsFromForm(form: TestFormPayload): string[] {
  const keys: string[] = [];
  for (const bundle of [form.reading.module1, form.reading.module2Lower, form.reading.module2Upper]) {
    for (const set of bundle.completeTheWords) keys.push(fingerprint(set.fullPassage));
    for (const set of bundle.dailyLife) keys.push(seedKey("daily", set));
    for (const set of bundle.academic) keys.push(seedKey("academic", set));
  }
  for (const bundle of [form.listening.module1, form.listening.module2Lower, form.listening.module2Upper]) {
    for (const item of bundle.choose) keys.push(fingerprint(item.audio.script));
    for (const set of [...bundle.conversations, ...bundle.announcements, ...bundle.talks]) {
      keys.push(seedKey(set.taskType === "listen_academic_talk" ? "talks" : set.taskType === "listen_announcement" ? "announcements" : "conversations", set));
    }
  }
  for (const item of form.writing.sentences) keys.push(seedKey("sentences", item));
  keys.push(fingerprint(form.writing.email.scenario || ""));
  keys.push(fingerprint(form.writing.discussion.prompt || ""));
  keys.push(seedKey("repeats", form.speaking.listenRepeat));
  keys.push(seedKey("interviews", form.speaking.interview));
  return [...new Set(keys.filter(Boolean))];
}

export function labelsFromForm(form: TestFormPayload): string[] {
  const labels = [...form.topics];
  for (const bundle of [form.reading.module1, form.reading.module2Lower, form.reading.module2Upper]) {
    for (const set of bundle.dailyLife) labels.push(set.title);
    for (const set of bundle.academic) labels.push(set.title);
  }
  for (const bundle of [form.listening.module1, form.listening.module2Lower, form.listening.module2Upper]) {
    for (const set of [...bundle.conversations, ...bundle.announcements, ...bundle.talks]) {
      labels.push(set.title);
    }
  }
  if (form.writing.email.scenario) labels.push(form.writing.email.scenario.slice(0, 80));
  if (form.writing.discussion.course) labels.push(form.writing.discussion.course);
  return [...new Set(labels.filter(Boolean))].slice(0, 40);
}

export function loadSeen(userId: string): { keys: Set<string>; labels: string[] } {
  const row = loadFile().users[userId];
  return { keys: new Set(row?.keys || []), labels: row?.labels || [] };
}

export function rememberSeen(userId: string, keys: string[], labels: string[] = []) {
  const file = loadFile();
  const prev = file.users[userId] || { keys: [], labels: [] };
  file.users[userId] = {
    keys: [...new Set([...prev.keys, ...keys])].slice(-800),
    labels: [...new Set([...prev.labels, ...labels])].slice(-80),
  };
  saveFile(file);
}

export async function seenForUser(userId: string): Promise<{ keys: Set<string>; labels: string[] }> {
  const stored = loadSeen(userId);
  if (stored.keys.size) return stored;
  const forms = await prisma.testForm.findMany({
    where: { userId },
    select: { payloadJson: true },
  });
  const keys = new Set<string>();
  const labels: string[] = [];
  for (const row of forms) {
    try {
      const form = JSON.parse(row.payloadJson) as TestFormPayload;
      for (const key of fingerprintsFromForm(form)) keys.add(key);
      labels.push(...labelsFromForm(form));
    } catch {
      /* skip broken payloads */
    }
  }
  if (keys.size) rememberSeen(userId, [...keys], labels);
  return { keys, labels: [...new Set(labels)] };
}
