import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { DATA_DIR } from "./paths";

export type ActivityKind = "generate" | "exam" | "account";

export type ActivityEntry = {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
};

type ActivityFile = {
  version: 1;
  users: Record<string, ActivityEntry[]>;
};

const FILE = path.join(DATA_DIR, "activity-log.json");
const MAX_PER_USER = 400;

function emptyFile(): ActivityFile {
  return { version: 1, users: {} };
}

function loadFile(): ActivityFile {
  try {
    if (!fs.existsSync(FILE)) return emptyFile();
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as ActivityFile;
    return { version: 1, users: raw.users || {} };
  } catch {
    return emptyFile();
  }
}

function saveFile(file: ActivityFile) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(file)}\n`, "utf8");
}

export function appendActivity(
  userId: string | null | undefined,
  kind: ActivityKind,
  title: string,
  detail?: string,
) {
  if (!userId) return;
  const file = loadFile();
  const entry: ActivityEntry = {
    id: randomBytes(6).toString("hex"),
    at: new Date().toISOString(),
    kind,
    title,
    detail,
  };
  const prev = file.users[userId] || [];
  file.users[userId] = [...prev, entry].slice(-MAX_PER_USER);
  saveFile(file);
}

export function listActivity(userId: string): ActivityEntry[] {
  const rows = loadFile().users[userId] || [];
  return [...rows].reverse();
}
