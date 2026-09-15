"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/base-path";
import { DIFFICULTY_OPTIONS, difficultyLabel } from "@/lib/generation/difficulty";
import { allScopeOptions, describeScope } from "@/lib/scope";
import type { ExamDifficulty, ScopePart } from "@/lib/types";
import { AppShell } from "../app-shell";
import { GhostButton, PrimaryButton } from "../ui";
import { AttemptScoreSummary, LibraryOverview, type DashboardForm } from "./results-dashboard";

type PrepLogEntry = {
  at: string;
  progress: number;
  stage: string;
  detail?: string;
};

type PrepJob = {
  id: string;
  difficulty?: string;
  intent: "start" | "prepare";
  status: "queued" | "running" | "ready" | "failed" | "cancelled";
  progress: number;
  stage: string;
  detail?: string;
  log?: PrepLogEntry[];
  formId?: string;
  sessionId?: string;
  error?: string;
  deadlineAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function elapsedLabel(iso?: string) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function remainingLabel(deadlineAt?: string) {
  if (!deadlineAt) return "";
  const seconds = Math.max(0, Math.floor((Date.parse(deadlineAt) - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

export function HomeLibrary() {
  const router = useRouter();
  const [forms, setForms] = useState<DashboardForm[]>([]);
  const [jobs, setJobs] = useState<PrepJob[]>([]);
  const [llmReady, setLlmReady] = useState(true);
  const [waitStartId, setWaitStartId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redo, setRedo] = useState<{ formId: string; sourceSessionId?: string } | null>(null);
  const [selected, setSelected] = useState<ScopePart[]>([]);
  const [allowReadapt, setAllowReadapt] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("standard");
  const [jobLimitMs, setJobLimitMs] = useState(12 * 60 * 1000);
  const [nowTick, setNowTick] = useState(0);
  const [prepareCount, setPrepareCount] = useState(1);
  const [maxHeldPapers, setMaxHeldPapers] = useState(8);
  const [maxPrepareBatch, setMaxPrepareBatch] = useState(5);
  const [unusedCount, setUnusedCount] = useState(0);
  const busy = jobs.some((job) => job.status === "queued" || job.status === "running");
  const starting = jobs.some(
    (job) => job.intent === "start" && (job.status === "queued" || job.status === "running"),
  );
  const waitJob =
    jobs.find((job) => job.id === waitStartId) ||
    jobs.find((job) => job.intent === "start" && (job.status === "queued" || job.status === "running"));
  const inflightCount = jobs.filter((job) => job.status === "queued" || job.status === "running").length;
  const heldCount = unusedCount + inflightCount;
  const room = Math.max(0, maxHeldPapers - heldCount);

  async function refresh() {
    const res = await fetch(appPath("/api/library"), { cache: "no-store", credentials: "same-origin" });
    if (res.status === 401) {
      window.location.assign(appPath("/login"));
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { forms?: DashboardForm[] };
    const next = Array.isArray(data.forms) ? data.forms : [];
    setForms(next);
    setUnusedCount(next.filter((form) => form.attempts.length === 0).length);
  }

  async function loadJobs() {
    const res = await fetch(appPath("/api/generate"), { cache: "no-store", credentials: "same-origin" });
    if (res.status === 401) {
      window.location.assign(appPath("/login"));
      return [];
    }
    const data = (await res.json().catch(() => ({}))) as {
      jobs?: PrepJob[];
      llmReady?: boolean;
      jobLimitMs?: number;
      unusedCount?: number;
      maxHeldPapers?: number;
      maxPrepareBatch?: number;
    };
    const next = Array.isArray(data.jobs) ? data.jobs : [];
    setJobs(next);
    if (typeof data.llmReady === "boolean") setLlmReady(data.llmReady);
    if (typeof data.jobLimitMs === "number" && data.jobLimitMs > 0) setJobLimitMs(data.jobLimitMs);
    if (typeof data.unusedCount === "number") setUnusedCount(data.unusedCount);
    if (typeof data.maxHeldPapers === "number") setMaxHeldPapers(data.maxHeldPapers);
    if (typeof data.maxPrepareBatch === "number") setMaxPrepareBatch(data.maxPrepareBatch);
    return next;
  }

  useEffect(() => {
    void refresh();
    void loadJobs().then((list) => {
      const runningStart = list.find(
        (job) => job.intent === "start" && (job.status === "queued" || job.status === "running"),
      );
      if (runningStart) {
        setWaitStartId(runningStart.id);
        setStartOpen(true);
      }
    });
    fetch(appPath("/api/auth/me"), { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { user?: { username?: string } | null }) => {
        if (data.user?.username) setUsername(data.user.username);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      setNowTick((n) => n + 1);
      void loadJobs();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!waitStartId) return;
    const job = jobs.find((row) => row.id === waitStartId);
    if (job?.status === "ready" && job.sessionId) {
      router.push(`/exam/${job.sessionId}`);
    }
    if (job?.status === "failed") {
      setError(job.error || "Preparation failed");
      setWaitStartId(null);
    }
    if (job?.status === "cancelled") {
      setError(job.error || "Preparation stopped");
      setWaitStartId(null);
    }
    if (job?.status === "ready" && job.formId && !job.sessionId) {
      void refresh();
      setWaitStartId(null);
    }
  }, [jobs, waitStartId, router]);

  useEffect(() => {
    if (jobs.some((job) => job.status === "ready" && job.formId)) void refresh();
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => {
      const hay = `${f.topics.join(" ")} ${f.attempts.map((a) => a.scopeLabel).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [forms, query]);
  const unusedForms = filtered.filter((form) => form.attempts.length === 0);
  const usedForms = filtered.filter((form) => form.attempts.length > 0);

  async function startJob(intent: "start" | "prepare") {
    setError(null);
    try {
      const count = intent === "prepare" ? Math.min(prepareCount, maxPrepareBatch, Math.max(1, room)) : 1;
      const res = await fetch(appPath("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ difficulty, intent, count }),
      });
      if (res.status === 401) {
        window.location.assign(appPath("/login"));
        return;
      }
      const data = (await res.json()) as {
        jobId?: string;
        job?: PrepJob;
        jobs?: PrepJob[];
        queued?: number;
        error?: string;
      };
      if (!res.ok || !data.jobId) throw new Error(data.error || "Could not start preparation");
      if (data.jobs?.length) {
        setJobs((prev) => {
          const incoming = new Set(data.jobs!.map((job) => job.id));
          return [...data.jobs!, ...prev.filter((row) => !incoming.has(row.id))];
        });
      } else if (data.job) {
        setJobs((prev) => [data.job!, ...prev.filter((row) => row.id !== data.jobId)]);
      }
      if (intent === "start") {
        setWaitStartId(data.jobId);
        setStartOpen(true);
      } else {
        setStartOpen(false);
      }
      void loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start preparation");
    }
  }

  async function closeJob(jobId: string) {
    setError(null);
    try {
      const res = await fetch(appPath(`/api/generate/${jobId}`), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.status === 401) {
        window.location.assign(appPath("/login"));
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not close this record");
      }
      setJobs((prev) => prev.filter((row) => row.id !== jobId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close this record");
    }
  }

  async function deleteUnused(formId: string) {
    if (!window.confirm("Delete this unused paper? You will not be able to start it later.")) return;
    setError(null);
    try {
      const res = await fetch(appPath(`/api/forms/${formId}`), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.status === 401) {
        window.location.assign(appPath("/login"));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not delete this paper");
      setForms((prev) => prev.filter((form) => form.id !== formId));
      setJobs((prev) => prev.filter((job) => job.formId !== formId));
      setUnusedCount((n) => Math.max(0, n - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this paper");
    }
  }

  async function stopJob(jobId: string) {
    setError(null);
    try {
      const res = await fetch(appPath(`/api/generate/${jobId}`), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.status === 401) {
        window.location.assign(appPath("/login"));
        return;
      }
      const data = (await res.json()) as { job?: PrepJob; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not stop preparation");
      if (data.job) setJobs((prev) => prev.map((row) => (row.id === jobId ? data.job! : row)));
      if (waitStartId === jobId) setWaitStartId(null);
      void loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop preparation");
    }
  }

  function renderJobProgress(job: PrepJob) {
    const active = job.status === "queued" || job.status === "running";
    const steps = (job.log || []).slice(-6).reverse();
    return (
      <div className="mt-3">
        {job.detail && <p className="muted text-sm">{job.detail}</p>}
        {active && (
          <>
            <div className="app-progress mt-3" aria-label={`${job.progress} percent`}>
              <span style={{ width: `${Math.max(4, Math.min(100, job.progress))}%` }} />
            </div>
            <p className="muted mt-2 text-xs">
              {job.progress}% · {elapsedLabel(job.createdAt) || "just started"}
              {job.deadlineAt ? ` · stops in ${remainingLabel(job.deadlineAt)}` : ` · stops after ${Math.round(jobLimitMs / 60000)} minutes`}
              <span className="sr-only">{nowTick}</span>
            </p>
          </>
        )}
        {steps.length > 0 && (
          <ol className="muted mt-3 space-y-1 text-xs">
            {steps.map((step, index) => (
              <li key={`${step.at}-${step.stage}-${index}`}>
                {index === 0 ? "Now: " : ""}
                {step.stage}
                {step.detail ? ` — ${step.detail}` : ""}
              </li>
            ))}
          </ol>
        )}
        {job.status === "failed" && job.error && <p className="mt-2 text-sm text-red-700">{job.error}</p>}
        {job.status === "cancelled" && <p className="mt-2 text-sm text-[#5b6775]">{job.error || "Stopped."}</p>}
      </div>
    );
  }

  async function startSession(body: {
    formId: string;
    mode: "new" | "retake" | "redo";
    scope: ScopePart[];
    sourceSessionId?: string;
    allowReadapt?: boolean;
  }) {
    const res = await fetch(appPath("/api/sessions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      window.location.assign(appPath("/login"));
      return;
    }
    const data = (await res.json()) as { sessionId?: string; error?: string };
    if (!res.ok || !data.sessionId) throw new Error(data.error || "Could not start");
    router.push(`/exam/${data.sessionId}`);
  }

  return (
    <AppShell
      nav={
        <>
          {username && <span className="mr-1 text-sm text-[#d7efe8]">{username}</span>}
          <Link href="/settings" className="ui-link">
            Gemini models
          </Link>
          <GhostButton
            onClick={() => {
              void fetch(appPath("/api/auth/logout"), { method: "POST", credentials: "same-origin" }).then(() => {
                window.location.href = appPath("/login");
              });
            }}
          >
            Sign out
          </GhostButton>
          <PrimaryButton tone="accent" onClick={() => setStartOpen(true)}>
            {busy ? "Preparing…" : "Start or prepare tests"}
          </PrimaryButton>
        </>
      }
    >
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Your practice library</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          Every new paper is unused for you. You can prepare several papers in advance — they queue one at a time so
          Gemini stays under its rate limit. A typical paper takes 2–6 minutes. You can hold up to {maxHeldPapers}{" "}
          unused or queued papers. Start one of the unused papers when you sit down.
        </p>
      </div>

      {jobs
        .filter((job) => {
          if (job.status === "queued" || job.status === "running") return true;
          if (job.status === "ready" && job.intent === "prepare" && job.formId && !forms.some((form) => form.id === job.formId)) {
            return true;
          }
          if (job.status === "failed" || job.status === "cancelled") {
            return !job.updatedAt || Date.now() - Date.parse(job.updatedAt) < 30 * 60 * 1000;
          }
          return false;
        })
        .map((job) => (
          <div key={job.id} className="app-notice panel mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {job.status === "failed"
                    ? "Preparation failed"
                    : job.status === "cancelled"
                      ? "Preparation stopped"
                      : job.intent === "prepare"
                        ? "Preparing a test for later"
                        : "Preparing a new test"}
                  {job.difficulty ? ` · ${difficultyLabel(job.difficulty)}` : ""}
                </p>
                <p className="muted mt-1 text-sm">{job.stage}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.status === "ready" && job.formId && (
                  <PrimaryButton
                    onClick={() => void startSession({ formId: job.formId!, mode: "new", scope: ["full"] })}
                  >
                    Start this paper
                  </PrimaryButton>
                )}
                {(job.status === "queued" || job.status === "running") && (
                  <GhostButton onClick={() => void stopJob(job.id)}>Stop</GhostButton>
                )}
                {(job.status === "failed" || job.status === "cancelled") && (
                  <GhostButton onClick={() => void closeJob(job.id)}>Close</GhostButton>
                )}
              </div>
            </div>
            {renderJobProgress(job)}
          </div>
        ))}
      {error && <div className="mb-4 text-sm text-red-700">{error}</div>}

      <LibraryOverview forms={filtered} />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by topic or section"
        className="field mb-5"
      />

      {unusedForms.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Unused papers ready ({unusedForms.length})</h2>
          <p className="muted mb-4 text-sm">
            These papers are already built. Start any one of them without waiting.
          </p>
          <div className="space-y-4">
            {unusedForms.map((form) => (
              <div key={form.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="muted text-sm">{new Date(form.createdAt).toLocaleString()}</div>
                    <div className="mt-1 font-medium">{form.topics.join(" · ") || "General academic"}</div>
                    <div className="mt-1 text-xs font-semibold text-[#0f766e]">{difficultyLabel(form.difficulty)}</div>
                    <div className="muted mt-2 text-sm">Prepared and unused — start whenever you want</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton onClick={() => void startSession({ formId: form.id, mode: "new", scope: ["full"] })}>
                      Start this paper
                    </PrimaryButton>
                    <GhostButton onClick={() => void deleteUnused(form.id)}>Delete</GhostButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-xl font-semibold">Every test result</h2>

      {usedForms.length === 0 && unusedForms.length === 0 && !busy && (
        <div className="panel muted p-8">
          No saved tests yet. Start a new test, or prepare several for later so they are waiting when you are ready.
        </div>
      )}

      <div className="space-y-4">
        {usedForms.map((form) => {
          const incomplete = form.attempts.find((a) => a.status === "in_progress" || a.status === "checkin");
          return (
            <div key={form.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="muted text-sm">{new Date(form.createdAt).toLocaleString()}</div>
                  <div className="mt-1 font-medium">{form.topics.join(" · ") || "General academic"}</div>
                  <div className="mt-1 text-xs font-semibold text-[#0f766e]">{difficultyLabel(form.difficulty)}</div>
                  <div className="muted mt-2 text-sm">
                    {`${form.attempts.length} sitting${form.attempts.length === 1 ? "" : "s"}${form.latestOverall != null ? " · scores below" : " · not finished yet"}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {incomplete && (
                    <PrimaryButton onClick={() => router.push(`/exam/${incomplete.id}`)}>Resume</PrimaryButton>
                  )}
                  {form.attempts.find((a) => a.status === "completed") && (
                    <GhostButton
                      onClick={() =>
                        router.push(`/review/${form.attempts.find((a) => a.status === "completed")!.id}`)
                      }
                    >
                      Review latest
                    </GhostButton>
                  )}
                  <GhostButton onClick={() => void startSession({ formId: form.id, mode: "retake", scope: ["full"] })}>
                    Retake full
                  </GhostButton>
                  <GhostButton onClick={() => setRedo({ formId: form.id, sourceSessionId: form.attempts[0]?.id })}>
                    Redo parts
                  </GhostButton>
                </div>
              </div>
              <div className="mt-2 space-y-4">
                {form.attempts.map((attempt) => (
                  <div key={attempt.id}>
                    {attempt.status !== "completed" || !attempt.analysis ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium capitalize">
                            {attempt.mode} · {attempt.scopeLabel} · {attempt.status}
                          </p>
                          <p className="muted">{new Date(attempt.createdAt).toLocaleString()}</p>
                        </div>
                        <GhostButton onClick={() => setRedo({ formId: form.id, sourceSessionId: attempt.id })}>
                          Redo from this
                        </GhostButton>
                      </div>
                    ) : (
                      <>
                        <AttemptScoreSummary attempt={attempt} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <PrimaryButton onClick={() => router.push(`/review/${attempt.id}`)}>
                            Full review
                          </PrimaryButton>
                          {form.attempts.filter((row) => row.status === "completed").length > 1 && (
                            <GhostButton
                              onClick={() => {
                                const other = form.attempts.find((row) => row.status === "completed" && row.id !== attempt.id);
                                if (other) router.push(`/compare?a=${attempt.id}&b=${other.id}`);
                              }}
                            >
                              Compare
                            </GhostButton>
                          )}
                          <GhostButton onClick={() => setRedo({ formId: form.id, sourceSessionId: attempt.id })}>
                            Redo from this
                          </GhostButton>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {startOpen && (
        <div className="app-modal">
          <div className="panel w-full max-w-xl p-6">
            <h2 className="mb-2 text-xl font-semibold">New unused tests</h2>
            <p className="muted mb-4 text-sm leading-6">
              Papers are unused for you. You can queue several; they build one after another. Each usually takes 2–6
              minutes and stops after {Math.round(jobLimitMs / 60000)} minutes. You currently have {heldCount} of{" "}
              {maxHeldPapers} unused or queued papers.
            </p>
            {!llmReady && (
              <p className="app-notice-warn mb-4 rounded-xl p-3 text-sm">
                No Gemini or OpenAI key is set. A new paper is only possible while unused bank items remain. Add a key
                if the unused pool is empty.
              </p>
            )}
            {waitJob && (waitJob.status === "queued" || waitJob.status === "running") ? (
              <div className="mb-4">
                <p className="text-sm font-semibold">{waitJob.stage}</p>
                {renderJobProgress(waitJob)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`block rounded-xl border p-3 text-sm ${
                        difficulty === option.id ? "border-[#0f766e] bg-[#ecfdf7]" : "border-[#d4ddd8]"
                      }`}
                    >
                      <input
                        type="radio"
                        className="mr-2"
                        checked={difficulty === option.id}
                        onChange={() => setDifficulty(option.id)}
                        disabled={starting}
                      />
                      <span className="font-semibold">{option.label}</span>
                      <p className="muted mt-1">{option.summary}</p>
                    </label>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">How many to prepare for later</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: maxPrepareBatch }, (_, index) => index + 1).map((count) => (
                      <button
                        key={count}
                        type="button"
                        disabled={count > room}
                        onClick={() => setPrepareCount(count)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          prepareCount === count ? "border-[#0f766e] bg-[#ecfdf7]" : "border-[#d4ddd8]"
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="muted mt-2 text-xs">
                    {room < 1
                      ? "Start or stop a paper before queueing more."
                      : `You can queue ${Math.min(prepareCount, room)} more now. Extra papers wait in line.`}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <GhostButton onClick={() => setStartOpen(false)}>
                {waitJob ? "Hide" : "Cancel"}
              </GhostButton>
              {waitJob && (waitJob.status === "queued" || waitJob.status === "running") && (
                <GhostButton onClick={() => void stopJob(waitJob.id)}>Stop preparing</GhostButton>
              )}
              {!waitJob && (
                <>
                  <GhostButton disabled={room < 1} onClick={() => void startJob("prepare")}>
                    Prepare {Math.min(prepareCount, Math.max(1, room))} for later
                  </GhostButton>
                  <PrimaryButton
                    tone="accent"
                    disabled={starting || room < 1}
                    onClick={() => void startJob("start")}
                  >
                    Start {difficultyLabel(difficulty)} when ready
                  </PrimaryButton>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {redo && (
        <div className="app-modal">
          <div className="panel max-h-[90vh] w-full max-w-xl overflow-auto p-6">
            <h2 className="mb-3 text-xl font-semibold">Redo selected parts</h2>
            <p className="muted mb-4 text-sm">
              Official clocks still apply to the parts you choose. Other section scores stay on the source attempt and can be used for a projected overall.
            </p>
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowReadapt}
                onChange={(e) => setAllowReadapt(e.target.checked)}
              />
              Allow re-adaptive routing for Reading/Listening
            </label>
            <div className="space-y-3">
              {["Reading", "Listening", "Writing", "Speaking"].map((group) => (
                <div key={group}>
                  <div className="mb-1 text-sm font-semibold">{group}</div>
                  <div className="grid gap-1">
                    {allScopeOptions()
                      .filter((o) => o.group === group)
                      .map((o) => (
                        <label key={o.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selected.includes(o.id)}
                            onChange={(e) => {
                              setSelected((prev) =>
                                e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                              );
                            }}
                          />
                          {o.label}
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => setRedo(null)}>Cancel</GhostButton>
              <PrimaryButton
                disabled={selected.length === 0}
                onClick={() =>
                  void startSession({
                    formId: redo.formId,
                    mode: "redo",
                    scope: selected,
                    sourceSessionId: redo.sourceSessionId,
                    allowReadapt,
                  })
                }
              >
                Start redo
              </PrimaryButton>
            </div>
            <p className="muted mt-3 text-xs">{describeScope(selected || ["full"])}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
