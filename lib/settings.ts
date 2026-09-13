import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

const FILE = path.join(DATA_DIR, "app-settings.json");

function readAll(): Record<string, string> {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string>) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export async function getSetting(key: string): Promise<string | null> {
  return readAll()[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const data = readAll();
  data[key] = value;
  writeAll(data);
}

export async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
