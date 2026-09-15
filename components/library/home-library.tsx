"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/base-path";
import { DIFFICULTY_OPTIONS, difficultyLabel } from "@/lib/generation/difficulty";
import { availableScopeOptions, describeScope, describeSubjects, normalizeScope, sectionEnabled, SUBJECT_OPTIONS } from "@/lib/scope";
import type { ExamDifficulty, ScopePart, SectionName } from "@/lib/types";
import { AppShell } from "../app-shell";
import { GhostButton, PrimaryButton } from "../ui";
import { AttemptScoreSummary, LibraryOverview, type DashboardForm } from "./results-dashboard";
import { SECTION_ORDER, SECTION_UI, SectionPills, sectionsFromScope } from "./section-marks";

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
  scope?: ScopePart[];
  subjects?: string[];
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
  const [prepSections, setPrepSections] = useState<SectionName[]>(["reading", "listening", "writing", "speaking"]);
  const [prepSubjects, setPrepSubjects] = useState<string[]>([]);
  const [maxHeldPapers, setMaxHeldPapers] = useState(8);
  const [maxPrepareBatch, setMaxPrepareBatch] = useState(5);
  const [unusedCount, setUnusedCount] = useState(0);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<SectionName | "all">("all");
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
      const hay = `${f.topics.join(" ")} ${f.scopeLabel || ""} ${f.subjectsLabel || ""} ${f.attempts.map((a) => a.scopeLabel).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [forms, query]);
  function matchesSectionFilter(form: DashboardForm) {
    if (sectionFilter === "all") return true;
    return sectionsFromScope(form.scope).includes(sectionFilter);
  }
  const unusedForms = filtered.filter((form) => form.attempts.length === 0).filter(matchesSectionFilter);
  const usedForms = filtered.filter((form) => form.attempts.length > 0).filter(matchesSectionFilter);
  const redoForm = redo ? forms.find((form) => form.id === redo.formId) : null;
  const redoScope = normalizeScope(redoForm?.scope);
  const redoOptions = availableScopeOptions(redoScope);
  const redoSections = SECTION_ORDER.filter((section) =>
    redoOptions.some((option) => option.group === SECTION_UI[section].name),
  );
  const redoCanReadapt = sectionEnabled(redoScope, "reading") || sectionEnabled(redoScope, "listening");
  const prepScope: ScopePart[] =
    prepSections.length === 4
      ? ["full"]
      : (["reading", "listening", "writing", "speaking"] as SectionName[]).filter((section) =>
          prepSections.includes(section),
        );

  async function startJob(intent: "start" | "prepare") {
    setError(null);
    try {
      const count = intent === "prepare" ? Math.min(prepareCount, maxPrepareBatch, Math.max(1, room)) : 1;
      const res = await fetch(appPath("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ difficulty, intent, count, scope: prepScope, subjects: prepSubjects }),
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

  async function removeResult(sessionId: string) {
    if (
      !window.confirm(
        "Remove this sitting from your dashboard? Its scores will no longer count in the averages. You will not be able to review it later.",
      )
    ) {
      return;
    }
    setError(null);
    setRemoving(sessionId);
    try {
      const res = await fetch(appPath(`/api/sessions/${sessionId}`), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.status === 401) {
        window.location.assign(appPath("/login"));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not remove this sitting");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this sitting");
    } finally {
      setRemoving(null);
    }
  }

  async function deletePaperAndResults(formId: string) {
    if (
      !window.confirm(
        "Delete this paper and every sitting on it? Those scores leave the dashboard and cannot be reviewed later.",
      )
    ) {
      return;
    }
    setError(null);
    setRemoving(formId);
    try {
      const res = await fetch(appPath(`/api/forms/${formId}?withResults=1`), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.status === 401) {
        window.location.assign(appPath("/login"));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not delete this paper");
      await refresh();
      setJobs((prev) => prev.filter((job) => job.formId !== formId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this paper");
    } finally {
      setRemoving(null);
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
    scope?: ScopePart[];
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
          <PrimaryButton
            tone="accent"
            onClick={() => {
              setPrepSections(["reading", "listening", "writing", "speaking"]);
              setStartOpen(true);
            }}
          >
            {busy ? "Preparing…" : "Start or prepare tests"}
          </PrimaryButton>
        </>
      }
    >
      <div className="library-hero">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Practice library</h1>
          <p className="muted mt-2 max-w-xl text-sm leading-6">
            Start a full paper or one section. Unused papers stay ready — up to {maxHeldPapers} at a time.
          </p>
        </div>
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
          <div key={job.id} className="app-notice panel job-banner mb-4 p-4">
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
                  {job.scope?.length ? ` · ${describeScope(job.scope)}` : ""}
                  {job.subjects?.length ? ` · ${describeSubjects(job.subjects)}` : ""}
                </p>
                <p className="muted mt-1 text-sm">{job.stage}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.status === "ready" && job.formId && (
                    <PrimaryButton onClick={() => void startSession({ formId: job.formId!, mode: "new", scope: job.scope })}>
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

      <LibraryOverview
        forms={filtered}
        filter={sectionFilter}
        onFilter={setSectionFilter}
        onPracticeSection={(section) => {
          setPrepSections([section]);
          setStartOpen(true);
        }}
      />

      {unusedForms.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Ready to start ({unusedForms.length})</h2>
          <div className="space-y-3">
            {unusedForms.map((form) => (
              <div key={form.id} className="paper-row panel">
                <div className="paper-row-main">
                  <div className="font-medium">{form.topics.join(" · ") || "General academic"}</div>
                  <div className="muted mt-1 text-sm">
                    {new Date(form.createdAt).toLocaleString()}
                    {` · ${difficultyLabel(form.difficulty)}`}
                    {form.subjectsLabel && form.subjectsLabel !== "Any subject" ? ` · ${form.subjectsLabel}` : ""}
                  </div>
                  <div className="mt-2">
                    <SectionPills included={sectionsFromScope(form.scope)} />
                  </div>
                </div>
                <div className="paper-row-actions">
                  <PrimaryButton onClick={() => void startSession({ formId: form.id, mode: "new", scope: form.scope as ScopePart[] | undefined })}>
                    Start
                  </PrimaryButton>
                  <GhostButton onClick={() => void deleteUnused(form.id)}>Delete</GhostButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="library-results-head">
        <h2 className="text-lg font-semibold">Results</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics"
          className="field library-search"
        />
      </div>

      {usedForms.length === 0 && unusedForms.length === 0 && !busy && (
        <div className="panel muted p-8">
          {sectionFilter !== "all" || query.trim()
            ? "No papers match this section filter. Clear the filter or prepare a paper in that category."
            : "No saved tests yet. Start a new test, or prepare several for later so they are waiting when you are ready."}
        </div>
      )}

      <div className="space-y-3">
        {usedForms.map((form) => {
          const incomplete = form.attempts.find((a) => a.status === "in_progress" || a.status === "checkin");
          const latestDone = form.attempts.find((a) => a.status === "completed");
          return (
            <div key={form.id} className="paper-row panel">
              <div className="paper-row-main">
                <div className="font-medium">{form.topics.join(" · ") || "General academic"}</div>
                <div className="muted mt-1 text-sm">
                  {new Date(form.createdAt).toLocaleString()}
                  {` · ${difficultyLabel(form.difficulty)}`}
                  {form.subjectsLabel && form.subjectsLabel !== "Any subject" ? ` · ${form.subjectsLabel}` : ""}
                  {` · ${form.attempts.length} sitting${form.attempts.length === 1 ? "" : "s"}`}
                </div>
                <div className="mt-2">
                  <SectionPills included={sectionsFromScope(form.scope)} />
                </div>
              </div>
              <div className="paper-row-actions">
                {incomplete ? (
                  <PrimaryButton onClick={() => router.push(`/exam/${incomplete.id}`)}>Resume</PrimaryButton>
                ) : latestDone ? (
                  <PrimaryButton onClick={() => router.push(`/review/${latestDone.id}`)}>Review</PrimaryButton>
                ) : null}
                <GhostButton onClick={() => void startSession({ formId: form.id, mode: "retake", scope: form.scope as ScopePart[] | undefined })}>
                  Retake
                </GhostButton>
                <GhostButton
                  onClick={() => {
                    setSelected([]);
                    setAllowReadapt(false);
                    setRedo({ formId: form.id, sourceSessionId: form.attempts[0]?.id });
                  }}
                >
                  Redo
                </GhostButton>
                <GhostButton disabled={removing === form.id} onClick={() => void deletePaperAndResults(form.id)}>
                  Delete
                </GhostButton>
              </div>
              <div className="paper-row-sittings">
                {form.attempts.map((attempt) => (
                  <div key={attempt.id} className="paper-sitting">
                    {attempt.status !== "completed" || !attempt.analysis ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p className="muted capitalize">
                          {attempt.mode} · {attempt.scopeLabel} · {attempt.status} ·{" "}
                          {new Date(attempt.createdAt).toLocaleString()}
                        </p>
                        <button
                          type="button"
                          className="paper-link"
                          disabled={removing === attempt.id}
                          onClick={() => void removeResult(attempt.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <AttemptScoreSummary attempt={attempt} />
                        <div className="paper-sitting-links">
                          <button type="button" className="paper-link" onClick={() => router.push(`/review/${attempt.id}`)}>
                            Review
                          </button>
                          {form.attempts.filter((row) => row.status === "completed").length > 1 && (
                            <button
                              type="button"
                              className="paper-link"
                              onClick={() => {
                                const other = form.attempts.find((row) => row.status === "completed" && row.id !== attempt.id);
                                if (other) router.push(`/compare?a=${attempt.id}&b=${other.id}`);
                              }}
                            >
                              Compare
                            </button>
                          )}
                          <button
                            type="button"
                            className="paper-link"
                            disabled={removing === attempt.id}
                            onClick={() => void removeResult(attempt.id)}
                          >
                            Remove
                          </button>
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
          <div className="panel w-full max-w-2xl p-6">
            <h2 className="mb-2 text-xl font-semibold">New unused tests</h2>
            <p className="muted mb-4 text-sm leading-6">
              Choose the test categories first. A full paper keeps all four on. Papers queue one after another and
              usually take 2–6 minutes. You currently have {heldCount} of {maxHeldPapers} unused or queued papers.
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
                <div>
                  <p className="mb-2 text-sm font-semibold">Test categories</p>
                  <div className="prep-section-grid">
                    {SECTION_ORDER.map((section) => {
                      const on = prepSections.includes(section);
                      const meta = SECTION_UI[section];
                      return (
                        <button
                          key={section}
                          type="button"
                          onClick={() =>
                            setPrepSections((prev) => {
                              const next = on ? prev.filter((item) => item !== section) : [...prev, section];
                              return next.length ? next : prev;
                            })
                          }
                          className={`prep-section prep-section-${section}${on ? " is-on" : ""}`}
                        >
                          <span className="cat-letter">{meta.letter}</span>
                          <span className="mt-2 block text-sm font-bold">{meta.name}</span>
                          <span className="muted mt-1 block text-xs leading-5">{meta.tasks}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="muted mt-2 text-xs">{describeScope(prepScope)}. Only those sections are written and scored.</p>
                </div>
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
                  <p className="mb-2 text-sm font-semibold">Subjects to include</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_OPTIONS.map((subject) => {
                      const on = prepSubjects.includes(subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() =>
                            setPrepSubjects((prev) =>
                              on ? prev.filter((item) => item !== subject) : [...prev, subject],
                            )
                          }
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                            on ? "border-[#0f766e] bg-[#ecfdf7]" : "border-[#d4ddd8]"
                          }`}
                        >
                          {subject}
                        </button>
                      );
                    })}
                  </div>
                  <p className="muted mt-2 text-xs">{describeSubjects(prepSubjects)}. Leave all off to allow any topic.</p>
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
              Only parts generated on this paper can be redone
              {redoForm?.scopeLabel ? ` (${redoForm.scopeLabel})` : ""}. Official clocks still apply. Other
              section scores stay on the source attempt.
            </p>
            {redoCanReadapt && (
              <label className="mb-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowReadapt}
                  onChange={(e) => setAllowReadapt(e.target.checked)}
                />
                Allow re-adaptive routing for Reading/Listening
              </label>
            )}
            <div className="space-y-3">
              {redoSections.map((section) => {
                const group = SECTION_UI[section].name;
                return (
                  <div key={group}>
                    <div className={`mb-1 text-sm font-semibold section-pill section-pill-${section}`}>
                      {SECTION_UI[section].letter} · {group}
                    </div>
                    <div className="grid gap-1">
                      {redoOptions
                        .filter((option) => option.group === group)
                        .map((option) => (
                          <label key={option.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.includes(option.id)}
                              onChange={(e) => {
                                setSelected((prev) =>
                                  e.target.checked ? [...prev, option.id] : prev.filter((item) => item !== option.id),
                                );
                              }}
                            />
                            {option.label}
                          </label>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {redoSections.length === 0 && (
              <p className="text-sm text-red-700">This paper has no parts that can be redone.</p>
            )}
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
                    allowReadapt: redoCanReadapt && allowReadapt,
                  })
                }
              >
                Start redo
              </PrimaryButton>
            </div>
            <p className="muted mt-3 text-xs">{describeScope(selected.length ? selected : redoScope)}</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
