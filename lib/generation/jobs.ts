import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { hasLlmKey } from "../llm";
import { DATA_DIR } from "../paths";
import { createPreparedForm, createSession } from "../sessions";
import type { ExamDifficulty } from "../types";

export type PrepIntent = "start" | "prepare";
export type PrepStatus = "queued" | "running" | "ready" | "failed";

export type PrepJob = {
  id: string;
  userId: string;
  difficulty: ExamDifficulty;
  intent: PrepIntent;
  status: PrepStatus;
  progress: number;
  stage: string;
  formId?: string;
  sessionId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const JOBS_PATH = path.join(DATA_DIR, "prep-jobs.json");
const STALE_MS = 3 * 60 * 60 * 1000;
const tails = new Map<string, Promise<void>>();

type JobsFile = { version: 1; jobs: PrepJob[] };

function emptyFile(): JobsFile {
  return { version: 1, jobs: [] };
}

function loadFile(): JobsFile {
  try {
    if (!fs.existsSync(JOBS_PATH)) return emptyFile();
    const raw = JSON.parse(fs.readFileSync(JOBS_PATH, "utf8")) as JobsFile;
    return { version: 1, jobs: raw.jobs || [] };
  } catch {
    return emptyFile();
  }
}

function saveFile(file: JobsFile) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  file.jobs = file.jobs.slice(-40);
  fs.writeFileSync(JOBS_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function isStale(job: PrepJob) {
  return (job.status === "running" || job.status === "queued") && Date.now() - Date.parse(job.updatedAt) > STALE_MS;
}

export function publicJob(job: PrepJob) {
  return {
    id: job.id,
    difficulty: job.difficulty,
    intent: job.intent,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    formId: job.formId,
    sessionId: job.sessionId,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function listJobsForUser(userId: string) {
  const file = loadFile();
  let dirty = false;
  for (const job of file.jobs) {
    if (job.userId === userId && isStale(job)) {
      job.status = "failed";
      job.error = "Preparation stopped because the server was restarted or the job went stale.";
      job.updatedAt = nowIso();
      dirty = true;
    }
  }
  if (dirty) saveFile(file);
  return file.jobs.filter((job) => job.userId === userId).map(publicJob);
}

export function getJobForUser(userId: string, jobId: string) {
  const job = loadFile().jobs.find((row) => row.id === jobId && row.userId === userId);
  return job ? publicJob(job) : null;
}

function updateJob(id: string, patch: Partial<PrepJob>) {
  const file = loadFile();
  const job = file.jobs.find((row) => row.id === id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: nowIso() });
  saveFile(file);
}

export function enqueuePrepJob(userId: string, difficulty: ExamDifficulty, intent: PrepIntent): PrepJob {
  const file = loadFile();
  for (const job of file.jobs) {
    if (job.userId === userId && isStale(job)) {
      job.status = "failed";
      job.error = "Preparation stopped because the server was restarted or the job went stale.";
      job.updatedAt = nowIso();
    }
  }
  const job: PrepJob = {
    id: randomBytes(9).toString("hex"),
    userId,
    difficulty,
    intent,
    status: "queued",
    progress: 1,
    stage: "Waiting to start",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  file.jobs.push(job);
  saveFile(file);
  return job;
}

export function runPrepJob(jobId: string) {
  const file = loadFile();
  const job = file.jobs.find((row) => row.id === jobId);
  if (!job) return Promise.resolve();
  const prev = tails.get(job.userId) || Promise.resolve();
  const next = prev.then(
    () => executeJob(jobId),
    () => executeJob(jobId),
  );
  tails.set(job.userId, next.then(
    () => undefined,
    () => undefined,
  ));
  return next;
}

async function executeJob(jobId: string) {
  const current = loadFile().jobs.find((row) => row.id === jobId);
  if (!current || current.status === "ready" || current.status === "failed") return;
  updateJob(jobId, { status: "running", progress: 3, stage: "Starting an all-new paper" });
  try {
    const form = await createPreparedForm(current.userId, current.difficulty, (update) => {
      updateJob(jobId, { status: "running", progress: update.progress, stage: update.stage });
    });
    if (current.intent === "start") {
      updateJob(jobId, { progress: 98, stage: "Opening the sitting" });
      const session = await createSession({
        formId: form.id,
        mode: "new",
        scope: ["full"],
        userId: current.userId,
      });
      updateJob(jobId, {
        status: "ready",
        progress: 100,
        stage: "Ready",
        formId: form.id,
        sessionId: session.id,
      });
      return;
    }
    updateJob(jobId, {
      status: "ready",
      progress: 100,
      stage: "Ready for later",
      formId: form.id,
    });
  } catch (err) {
    updateJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Preparation failed",
      stage: "Failed",
    });
  }
}

export function llmReady() {
  return hasLlmKey();
}
