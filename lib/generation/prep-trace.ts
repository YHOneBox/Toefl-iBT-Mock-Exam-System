import fs from "fs";
import path from "path";
import { DATA_DIR } from "../paths";

export type PrepTraceEvent = {
  at: string;
  type: string;
  progress?: number;
  stage?: string;
  detail?: string;
  error?: string;
  data?: Record<string, string | number | boolean | string[] | null | undefined>;
};

const DIR = path.join(DATA_DIR, "prep-logs");

function safeJobId(jobId: string) {
  return jobId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

export function prepLogPath(jobId: string) {
  return path.join(DIR, `${safeJobId(jobId)}.jsonl`);
}

export function appendPrepTrace(jobId: string | undefined, event: Omit<PrepTraceEvent, "at">) {
  if (!jobId) return;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const row: PrepTraceEvent = { at: new Date().toISOString(), ...event };
    fs.appendFileSync(prepLogPath(jobId), `${JSON.stringify(row)}\n`);
  } catch {
    /* never block generation on logging */
  }
}

export function readPrepTrace(jobId: string): PrepTraceEvent[] {
  try {
    const raw = fs.readFileSync(prepLogPath(jobId), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PrepTraceEvent);
  } catch {
    return [];
  }
}
