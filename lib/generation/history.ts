import fs from "fs";
import path from "path";
import { prisma } from "../db";
import { DATA_DIR } from "../paths";
import type { TestFormPayload } from "../types";
import { keysForRemember, labelsFromUniqueness } from "./uniqueness";

const HISTORY_PATH = path.join(DATA_DIR, "seen-items.json");
const KEY_CAP = 4000;
const LABEL_CAP = 200;

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
  return keysForRemember(form);
}

export function labelsFromForm(form: TestFormPayload): string[] {
  return labelsFromUniqueness(form);
}

export function loadSeen(userId: string): { keys: Set<string>; labels: string[] } {
  const row = loadFile().users[userId];
  return { keys: new Set(row?.keys || []), labels: row?.labels || [] };
}

export function rememberSeen(userId: string, keys: string[], labels: string[] = []) {
  const file = loadFile();
  const prev = file.users[userId] || { keys: [], labels: [] };
  file.users[userId] = {
    keys: [...new Set([...prev.keys, ...keys])].slice(-KEY_CAP),
    labels: [...new Set([...prev.labels, ...labels])].slice(-LABEL_CAP),
  };
  saveFile(file);
}

export async function seenForUser(userId: string): Promise<{ keys: Set<string>; labels: string[] }> {
  const stored = loadSeen(userId);
  const forms = await prisma.testForm.findMany({
    where: { userId },
    select: { payloadJson: true },
  });
  const keys = new Set(stored.keys);
  const labels = [...stored.labels];
  for (const row of forms) {
    try {
      const form = JSON.parse(row.payloadJson) as TestFormPayload;
      for (const key of fingerprintsFromForm(form)) keys.add(key);
      labels.push(...labelsFromForm(form));
    } catch {
      /* skip broken payloads */
    }
  }
  const uniqueLabels = [...new Set(labels)];
  rememberSeen(userId, [...keys], uniqueLabels);
  return { keys, labels: uniqueLabels };
}
