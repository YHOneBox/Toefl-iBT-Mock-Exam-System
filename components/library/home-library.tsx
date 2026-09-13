"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY_OPTIONS, difficultyLabel } from "@/lib/generation/difficulty";
import { allScopeOptions, describeScope } from "@/lib/scope";
import type { ExamDifficulty, ScopePart } from "@/lib/types";
import { GhostButton, PrimaryButton } from "../ui";
import { AttemptAnalysisCard, LibraryOverview, type DashboardForm } from "./results-dashboard";

export function HomeLibrary() {
  const router = useRouter();
  const [forms, setForms] = useState<DashboardForm[]>([]);
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redo, setRedo] = useState<{ formId: string; sourceSessionId?: string } | null>(null);
  const [selected, setSelected] = useState<ScopePart[]>([]);
  const [allowReadapt, setAllowReadapt] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("standard");

  async function refresh() {
    const res = await fetch("/api/library", { cache: "no-store" });
    const data = (await res.json()) as { forms: DashboardForm[] };
    setForms(data.forms);
  }

  useEffect(() => {
    void refresh();
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { user?: { username?: string } | null }) => {
        if (data.user?.username) setUsername(data.user.username);
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => {
      const hay = `${f.topics.join(" ")} ${f.attempts.map((a) => a.scopeLabel).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [forms, query]);

  async function startNew() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      const data = (await res.json()) as { sessionId?: string; error?: string };
      if (!res.ok || !data.sessionId) throw new Error(data.error || "Generation failed");
      router.push(`/exam/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setGenerating(false);
    }
  }

  async function startSession(body: {
    formId: string;
    mode: "retake" | "redo";
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-normal">TOEFL iBT Mock</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 tracking-normal text-[#5b6775]">
            Local practice for the enhanced exam. Finished sittings appear in the dashboard below with a full score
            analysis. You can still open a paper to review items, retake, or redo selected parts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {username && <span className="mr-1 text-sm text-[#5b6775]">{username}</span>}
          <a href="/settings" className="rounded border border-[#9aa8b5] bg-white px-4 py-2 text-sm">
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
          <PrimaryButton disabled={generating} onClick={() => setStartOpen(true)}>
            {generating ? "Preparing test…" : "Start new test"}
          </PrimaryButton>
        </div>
      </div>

      {generating && (
        <div className="panel mb-6 p-5 text-sm">
          Assembling a full form: original items from the subject pack when a model key is set, both Reading and Listening Module 2 variants, and audio. This can take one to three minutes.
        </div>
      )}
      {error && <div className="mb-4 text-sm text-red-700">{error}</div>}

      <LibraryOverview forms={filtered} />

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by topic or section"
        className="mb-5 w-full border border-[#c5d0da] px-3 py-2"
      />

      <h2 className="mb-3 text-xl font-semibold">Every test result</h2>

      {filtered.length === 0 && !generating && (
        <div className="panel p-8 text-[#5b6775]">
          No saved tests yet. Start a new test to create your first paper.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((form) => {
          const incomplete = form.attempts.find((a) => a.status === "in_progress" || a.status === "checkin");
          return (
            <div key={form.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[#5b6775]">{new Date(form.createdAt).toLocaleString()}</div>
                  <div className="mt-1 font-medium">{form.topics.join(" · ") || "General academic"}</div>
                  <div className="mt-1 text-xs text-[#1f4e79]">{difficultyLabel(form.difficulty)}</div>
                  <div className="mt-2 text-sm text-[#5b6775]">
                    {form.attempts.length} sitting{form.attempts.length === 1 ? "" : "s"}
                    {form.latestOverall != null ? " · analysis below" : " · not finished yet"}
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
                          <p className="text-[#5b6775]">{new Date(attempt.createdAt).toLocaleString()}</p>
                        </div>
                        <GhostButton onClick={() => setRedo({ formId: form.id, sourceSessionId: attempt.id })}>
                          Redo from this
                        </GhostButton>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <GhostButton onClick={() => router.push(`/review/${attempt.id}`)}>Review items</GhostButton>
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
                        <AttemptAnalysisCard attempt={attempt} />
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
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
          <div className="panel w-full max-w-xl p-6">
            <h2 className="mb-2 text-xl font-semibold">New test difficulty</h2>
            <p className="mb-4 text-sm leading-6 text-[#5b6775]">
              Standard follows the enhanced TOEFL iBT: adaptive Reading and Listening, 10 Build-a-Sentence items, one
              email, one discussion, seven repeats, and four interview questions. Official clocks stay the same on every
              level.
            </p>
            <div className="space-y-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`block rounded border p-3 text-sm ${
                    difficulty === option.id ? "border-[#1f4e79] bg-[#e8f1fb]" : "border-[#d5dbe3]"
                  }`}
                >
                  <input
                    type="radio"
                    className="mr-2"
                    checked={difficulty === option.id}
                    onChange={() => setDifficulty(option.id)}
                  />
                  <span className="font-semibold">{option.label}</span>
                  <p className="mt-1 text-[#5b6775]">{option.summary}</p>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => setStartOpen(false)}>Cancel</GhostButton>
              <PrimaryButton
                disabled={generating}
                onClick={() => {
                  setStartOpen(false);
                  void startNew();
                }}
              >
                Start {difficultyLabel(difficulty)}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {redo && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
          <div className="panel max-h-[90vh] w-full max-w-xl overflow-auto p-6">
            <h2 className="mb-3 text-xl font-semibold">Redo selected parts</h2>
            <p className="mb-4 text-sm text-[#5b6775]">
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
            <p className="mt-3 text-xs text-[#5b6775]">{describeScope(selected || ["full"])}</p>
          </div>
        </div>
      )}
    </div>
  );
}
