"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY_OPTIONS, difficultyLabel } from "@/lib/generation/difficulty";
import { allScopeOptions, describeScope } from "@/lib/scope";
import type { ExamDifficulty, ScopePart } from "@/lib/types";
import { AppShell } from "../app-shell";
import { GhostButton, PrimaryButton } from "../ui";
import { AttemptScoreSummary, LibraryOverview, type DashboardForm } from "./results-dashboard";

type PrepJob = {
  id: string;
  difficulty?: string;
  intent: "start" | "prepare";
  status: "queued" | "running" | "ready" | "failed";
  progress: number;
  stage: string;
  formId?: string;
  sessionId?: string;
  error?: string;
};

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
  const busy = jobs.some((job) => job.status === "queued" || job.status === "running");
  const waitJob = jobs.find((job) => job.id === waitStartId) || jobs.find((job) => job.intent === "start" && (job.status === "queued" || job.status === "running"));

  async function refresh() {
    const res = await fetch("/api/library", { cache: "no-store" });
    const data = (await res.json()) as { forms: DashboardForm[] };
    setForms(data.forms);
  }

  async function loadJobs() {
    const res = await fetch("/api/generate", { cache: "no-store" });
    const data = (await res.json()) as { jobs?: PrepJob[]; llmReady?: boolean };
    const next = data.jobs || [];
    setJobs(next);
    if (typeof data.llmReady === "boolean") setLlmReady(data.llmReady);
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
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { user?: { username?: string } | null }) => {
        if (data.user?.username) setUsername(data.user.username);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
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

  async function startJob(intent: "start" | "prepare") {
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, intent }),
      });
      const data = (await res.json()) as { jobId?: string; job?: PrepJob; error?: string };
      if (!res.ok || !data.jobId) throw new Error(data.error || "Could not start preparation");
      if (data.job) setJobs((prev) => [data.job!, ...prev.filter((row) => row.id !== data.jobId)]);
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

  async function startSession(body: {
    formId: string;
    mode: "new" | "retake" | "redo";
    scope: ScopePart[];
    sourceSessionId?: string;
    allowReadapt?: boolean;
  }) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { sessionId?: string; error?: string };
    if (!res.ok || !data.sessionId) throw new Error(data.error || "Could not start");
    router.push(`/exam/${data.sessionId}`);
  }

  return (
    <AppShell
      nav={
        <>
          {username && <span className="mr-1 text-sm text-[#d7efe8]">{username}</span>}
          <a href="/settings" className="ui-link">
            Gemini models
          </a>
          <GhostButton
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/login";
              });
            }}
          >
            Sign out
          </GhostButton>
          <PrimaryButton tone="accent" disabled={busy} onClick={() => setStartOpen(true)}>
            {busy ? "Preparing…" : "Start new test"}
          </PrimaryButton>
        </>
      }
    >
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Your practice library</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          Every new paper is unused for you. The app keeps writing original items until nothing repeats, then builds
          audio. Prepare a test in advance if you do not want to wait when you sit down. The live exam still uses the
          navy sitting screens.
        </p>
      </div>

      {jobs
        .filter(
          (job) =>
            job.status === "queued" ||
            job.status === "running" ||
            (job.status === "ready" &&
              job.intent === "prepare" &&
              job.formId &&
              !forms.some((form) => form.id === job.formId)),
        )
        .map((job) => (
          <div key={job.id} className="app-notice panel mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {job.intent === "prepare" ? "Preparing a test for later" : "Preparing a new test"}
                  {job.difficulty ? ` · ${difficultyLabel(job.difficulty)}` : ""}
                </p>
                <p className="muted mt-1 text-sm">{job.stage}</p>
              </div>
              {job.status === "ready" && job.formId && (
                <PrimaryButton
                  onClick={() => void startSession({ formId: job.formId!, mode: "new", scope: ["full"] })}
                >
                  Start this paper
                </PrimaryButton>
              )}
            </div>
            {job.status !== "ready" && (
              <div className="app-progress mt-3" aria-label={`${job.progress} percent`}>
                <span style={{ width: `${Math.max(4, Math.min(100, job.progress))}%` }} />
              </div>
            )}
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

      <h2 className="mb-3 text-xl font-semibold">Every test result</h2>

      {filtered.length === 0 && !busy && (
        <div className="panel muted p-8">
          No saved tests yet. Start a new test, or prepare one for later so it is waiting when you are ready.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((form) => {
          const incomplete = form.attempts.find((a) => a.status === "in_progress" || a.status === "checkin");
          const unused = form.attempts.length === 0;
          return (
            <div key={form.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="muted text-sm">{new Date(form.createdAt).toLocaleString()}</div>
                  <div className="mt-1 font-medium">{form.topics.join(" · ") || "General academic"}</div>
                  <div className="mt-1 text-xs font-semibold text-[#0f766e]">{difficultyLabel(form.difficulty)}</div>
                  <div className="muted mt-2 text-sm">
                    {unused
                      ? "Prepared and unused — start whenever you want"
                      : `${form.attempts.length} sitting${form.attempts.length === 1 ? "" : "s"}${form.latestOverall != null ? " · scores below" : " · not finished yet"}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unused && (
                    <PrimaryButton onClick={() => void startSession({ formId: form.id, mode: "new", scope: ["full"] })}>
                      Start this paper
                    </PrimaryButton>
                  )}
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
                  {!unused && (
                    <>
                      <GhostButton onClick={() => void startSession({ formId: form.id, mode: "retake", scope: ["full"] })}>
                        Retake full
                      </GhostButton>
                      <GhostButton onClick={() => setRedo({ formId: form.id, sourceSessionId: form.attempts[0]?.id })}>
                        Redo parts
                      </GhostButton>
                    </>
                  )}
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
            <h2 className="mb-2 text-xl font-semibold">New unused test</h2>
            <p className="muted mb-4 text-sm leading-6">
              The app will not reuse a question you have already seen. It keeps writing original items until the whole
              paper is new, then creates audio. That can take several minutes. Prepare for later if you want the wait
              to happen now and the sitting to start instantly next time.
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
                <div className="app-progress mt-3" aria-label={`${waitJob.progress} percent`}>
                  <span style={{ width: `${Math.max(4, Math.min(100, waitJob.progress))}%` }} />
                </div>
                <p className="muted mt-2 text-xs">{waitJob.progress}% · you can leave this open</p>
              </div>
            ) : (
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
                      disabled={busy}
                    />
                    <span className="font-semibold">{option.label}</span>
                    <p className="muted mt-1">{option.summary}</p>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <GhostButton onClick={() => setStartOpen(false)}>
                {waitJob ? "Hide" : "Cancel"}
              </GhostButton>
              {!waitJob && (
                <>
                  <GhostButton disabled={busy} onClick={() => void startJob("prepare")}>
                    Prepare for later
                  </GhostButton>
                  <PrimaryButton tone="accent" disabled={busy} onClick={() => void startJob("start")}>
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
