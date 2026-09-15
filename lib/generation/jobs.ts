import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { appendActivity } from "../activity-log";
import { hasLlmKey } from "../llm";
import { DATA_DIR } from "../paths";
import { createPreparedForm, createSession } from "../sessions";
import { describeScope, describeSubjects, normalizeScope, normalizeSubjects } from "../scope";
import type { ExamDifficulty, ScopePart } from "../types";
import { appendPrepTrace } from "./prep-trace";

export type PrepIntent = "start" | "prepare";
export type PrepStatus = "queued" | "running" | "ready" | "failed" | "cancelled";

export type PrepLogEntry = {
  at: string;
  progress: number;
  stage: string;
  detail?: string;
};

export type PrepJob = {
  id: string;
  userId: string;
  difficulty: ExamDifficulty;
  intent: PrepIntent;
  scope?: ScopePart[];
  subjects?: string[];
  status: PrepStatus;
  progress: number;
  stage: string;
  detail?: string;
  log?: PrepLogEntry[];
  formId?: string;
  sessionId?: string;
  error?: string;
  cancelRequested?: boolean;
  deadlineAt?: string;
  createdAt: string;
  updatedAt: string;
  hidden?: boolean;
};

const JOBS_PATH = path.join(DATA_DIR, "prep-jobs.json");
export const PREP_JOB_LIMIT_MS = 12 * 60 * 1000;
export const PREP_STALE_MS = 4 * 60 * 1000;
export const MAX_PREPARE_BATCH = 5;
export const MAX_HELD_PAPERS = 8;
const MAX_LOG = 160;
const tails = new Map<string, Promise<void>>();
const controllers = new Map<string, AbortController>();

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

function isOverLimit(job: PrepJob) {
  return (
    (job.status === "running" || job.status === "queued") &&
    Date.now() - Date.parse(job.createdAt) > PREP_JOB_LIMIT_MS
  );
}

function isStale(job: PrepJob) {
  return (
    (job.status === "running" || job.status === "queued") &&
    Date.now() - Date.parse(job.updatedAt) > PREP_STALE_MS
  );
}

function closeStaleJobs(file: JobsFile) {
  let dirty = false;
  for (const job of file.jobs) {
    if (isOverLimit(job)) {
      job.status = "failed";
      job.error = "Preparation stopped because it ran longer than 12 minutes.";
      job.stage = "Timed out";
      job.updatedAt = nowIso();
      dirty = true;
    } else if (isStale(job)) {
      job.status = "failed";
      job.error = "Preparation stopped because it stopped reporting progress.";
      job.stage = "Stopped";
      job.updatedAt = nowIso();
      dirty = true;
    }
  }
  return dirty;
}

export function publicJob(job: PrepJob) {
  return {
    id: job.id,
    difficulty: job.difficulty,
    intent: job.intent,
    scope: job.scope || ["full"],
    subjects: job.subjects || [],
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    detail: job.detail,
    log: job.log || [],
    formId: job.formId,
    sessionId: job.sessionId,
    error: job.error,
    deadlineAt: job.deadlineAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function listJobsForUser(userId: string) {
  const file = loadFile();
  if (closeStaleJobs(file)) saveFile(file);
  return file.jobs.filter((job) => job.userId === userId && !job.hidden).map(publicJob);
}

export function getJobForUser(userId: string, jobId: string) {
  const file = loadFile();
  if (closeStaleJobs(file)) saveFile(file);
  const job = file.jobs.find((row) => row.id === jobId && row.userId === userId);
  return job ? publicJob(job) : null;
}

function pushLog(job: PrepJob, progress: number, stage: string, detail?: string) {
  const last = job.log?.[job.log.length - 1];
  if (last && last.stage === stage && last.progress === progress && last.detail === detail) return;
  job.log = [...(job.log || []), { at: nowIso(), progress, stage, detail }].slice(-MAX_LOG);
}

function updateJob(id: string, patch: Partial<PrepJob>) {
  const file = loadFile();
  const job = file.jobs.find((row) => row.id === id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: nowIso() });
  if (patch.stage || patch.detail || typeof patch.progress === "number") {
    pushLog(job, job.progress, job.stage, job.detail);
    appendActivity(job.userId, "generate", job.stage, job.detail);
    appendPrepTrace(id, {
      type: "job",
      progress: job.progress,
      stage: job.stage,
      detail: job.detail,
      error: job.error,
    });
  }
  saveFile(file);
}

export function inflightJobCount(userId: string) {
  const file = loadFile();
  if (closeStaleJobs(file)) saveFile(file);
  return file.jobs.filter(
    (job) => job.userId === userId && (job.status === "queued" || job.status === "running"),
  ).length;
}

export function enqueuePrepJob(
  userId: string,
  difficulty: ExamDifficulty,
  intent: PrepIntent,
  opts?: { scope?: ScopePart[]; subjects?: string[] },
): PrepJob {
  const file = loadFile();
  closeStaleJobs(file);
  const scope = normalizeScope(opts?.scope);
  const subjects = normalizeSubjects(opts?.subjects);
  const ahead = file.jobs.filter(
    (job) => job.userId === userId && (job.status === "queued" || job.status === "running"),
  ).length;
  const now = nowIso();
  const queued = ahead > 0;
  const stage = queued ? `Waiting behind ${ahead} paper${ahead === 1 ? "" : "s"}` : "Waiting to start";
  const detail = `${describeScope(scope)} · ${describeSubjects(subjects)}`;
  const job: PrepJob = {
    id: randomBytes(9).toString("hex"),
    userId,
    difficulty,
    intent,
    scope,
    subjects,
    status: "queued",
    progress: 1,
    stage,
    detail,
    log: [{ at: now, progress: 1, stage, detail }],
    deadlineAt: new Date(Date.now() + PREP_JOB_LIMIT_MS).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
  file.jobs.push(job);
  saveFile(file);
  appendPrepTrace(job.id, { type: "queued", stage, detail, data: { difficulty, scope, subjects, intent } });
  appendActivity(
    userId,
    "generate",
    intent === "prepare" ? "Queued a paper to prepare for later" : "Queued a new paper to start",
    `${difficulty} · ${detail} · ${stage}`,
  );
  return job;
}

export function cancelPrepJob(userId: string, jobId: string) {
  const file = loadFile();
  const job = file.jobs.find((row) => row.id === jobId && row.userId === userId);
  if (!job) return null;
  if (job.status === "ready" || job.status === "failed" || job.status === "cancelled") return publicJob(job);
  job.cancelRequested = true;
  job.status = "cancelled";
  job.stage = "Stopped";
  job.detail = "You stopped this paper.";
  job.error = "Stopped by you.";
  job.updatedAt = nowIso();
  pushLog(job, job.progress, job.stage, job.detail);
  saveFile(file);
  controllers.get(jobId)?.abort();
  appendActivity(userId, "generate", "Stopped a preparation", job.detail);
  return publicJob(job);
}

export function dismissPrepJob(userId: string, jobId: string) {
  const file = loadFile();
  const job = file.jobs.find((row) => row.id === jobId && row.userId === userId);
  if (!job) return null;
  if (job.status === "queued" || job.status === "running") return null;
  job.hidden = true;
  job.updatedAt = nowIso();
  saveFile(file);
  appendActivity(userId, "generate", "Closed a preparation record", job.error || job.stage);
  return publicJob(job);
}

export function hideJobsForForm(userId: string, formId: string) {
  const file = loadFile();
  let dirty = false;
  for (const job of file.jobs) {
    if (job.userId === userId && job.formId === formId && !job.hidden) {
      job.hidden = true;
      job.updatedAt = nowIso();
      dirty = true;
    }
  }
  if (dirty) saveFile(file);
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
  tails.set(
    job.userId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

function jobMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Preparation failed";
}

function isStopError(err: unknown) {
  const message = jobMessage(err);
  return /stopped|timed out|12 minutes|aborted/i.test(message);
}

async function executeJob(jobId: string) {
  const current = loadFile().jobs.find((row) => row.id === jobId);
  if (!current || current.status === "ready" || current.status === "failed" || current.status === "cancelled") return;
  if (current.cancelRequested) {
    updateJob(jobId, { status: "cancelled", stage: "Stopped", error: "Stopped by you.", detail: "You stopped this paper." });
    return;
  }
  const controller = new AbortController();
  controllers.set(jobId, controller);
  const deadline = Date.parse(current.deadlineAt || "") || Date.now() + PREP_JOB_LIMIT_MS;
  const heartbeat = setInterval(() => {
    if (Date.now() > deadline) controller.abort();
    const live = loadFile().jobs.find((row) => row.id === jobId);
    if (!live || live.status === "cancelled" || live.cancelRequested) {
      controller.abort();
      return;
    }
    updateJob(jobId, {});
  }, 15_000);
  updateJob(jobId, {
    status: "running",
    progress: 3,
    stage: "Starting an all-new paper",
    detail: "Stops automatically after 12 minutes, or when you press Stop",
  });
  try {
    const form = await createPreparedForm(
      current.userId,
      current.difficulty,
      (update) => {
        if (controller.signal.aborted) throw new Error("Preparation was stopped.");
        const live = loadFile().jobs.find((row) => row.id === jobId);
        if (!live || live.status === "cancelled" || live.cancelRequested) {
          controller.abort();
          throw new Error("Preparation was stopped.");
        }
        updateJob(jobId, {
          status: "running",
          progress: update.progress,
          stage: update.stage,
          detail: update.detail,
        });
      },
      {
        signal: controller.signal,
        jobId,
        scope: current.scope,
        subjects: current.subjects,
      },
    );
    const latest = loadFile().jobs.find((row) => row.id === jobId);
    if (!latest || latest.status === "cancelled" || latest.cancelRequested) return;
    if (current.intent === "start") {
      updateJob(jobId, { progress: 98, stage: "Opening the sitting", detail: "Creating your exam session" });
      const session = await createSession({
        formId: form.id,
        mode: "new",
        scope: current.scope,
        userId: current.userId,
      });
      updateJob(jobId, {
        status: "ready",
        progress: 100,
        stage: "Ready",
        detail: "The unused paper is ready",
        formId: form.id,
        sessionId: session.id,
      });
      return;
    }
    updateJob(jobId, {
      status: "ready",
      progress: 100,
      stage: "Ready for later",
      detail: "Start this paper whenever you want",
      formId: form.id,
    });
  } catch (err) {
    const live = loadFile().jobs.find((row) => row.id === jobId);
    if (live?.status === "cancelled" || live?.cancelRequested) {
      updateJob(jobId, {
        status: "cancelled",
        stage: "Stopped",
        error: "Stopped by you.",
        detail: "You stopped this paper.",
      });
      return;
    }
    if (Date.now() > deadline || /12 minutes/i.test(jobMessage(err))) {
      updateJob(jobId, {
        status: "failed",
        error: "Preparation stopped because it ran longer than 12 minutes.",
        stage: "Timed out",
        detail: "Try again. A later attempt can reuse unused items already written.",
      });
      return;
    }
    if (isStopError(err)) {
      updateJob(jobId, {
        status: "cancelled",
        error: "Stopped by you.",
        stage: "Stopped",
        detail: "You stopped this paper.",
      });
      return;
    }
    appendPrepTrace(jobId, { type: "failed", stage: "Failed", error: jobMessage(err) });
    updateJob(jobId, {
      status: "failed",
      error: jobMessage(err),
      stage: "Failed",
      detail: "Nothing was saved. You can start again.",
    });
  } finally {
    clearInterval(heartbeat);
    controllers.delete(jobId);
  }
}

export function llmReady() {
  return hasLlmKey();
}
