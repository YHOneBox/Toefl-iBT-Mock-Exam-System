"use client";

import { useEffect, useState } from "react";
import { appPath } from "@/lib/base-path";
import type { ClientSession } from "@/lib/client-types";
import { parseTiming } from "@/lib/timing-log";
import { GhostButton } from "../ui";

const STAGES = [
  "Currently submitting your answers…",
  "Currently transcribing your speaking recordings…",
  "Currently scoring writing and speaking…",
  "Currently assembling your score report…",
];

function isDone(session: Pick<ClientSession, "status" | "currentPointer">) {
  return session.status === "completed" || session.currentPointer === "completed";
}

export function ScoringWait({
  sessionId,
  onComplete,
}: {
  sessionId: string;
  onComplete: (session: ClientSession) => void;
}) {
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const rotate = window.setInterval(() => setStage((n) => (n + 1) % STAGES.length), 7000);
    const clock = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => {
      window.clearInterval(rotate);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(appPath(`/api/sessions/${sessionId}`), { cache: "no-store" });
        const data = (await res.json()) as ClientSession & { error?: string };
        if (stop) return;
        if (!res.ok || data.error || !data.form) {
          setError(data.error || "Could not check scoring progress.");
          return;
        }
        const next = { ...data, timing: parseTiming(data.timing) };
        if (isDone(next)) {
          onComplete(next);
          return;
        }
        setError(null);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Could not check scoring progress.");
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sessionId, onComplete]);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const advance = await fetch(appPath(`/api/sessions/${sessionId}/advance`), { method: "POST" });
      if (!advance.ok && advance.status !== 409) {
        const data = (await advance.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not submit the test.");
        return;
      }
      const res = await fetch(appPath(`/api/sessions/${sessionId}/score`), { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok && res.status !== 409) {
        setError(data.error || "Could not restart scoring.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restart scoring.");
    } finally {
      setRetrying(false);
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="scoring-wait">
      <div className="scoring-wait-card">
        <p className="scoring-wait-kicker">Please wait</p>
        <h1>The system is currently scoring your test</h1>
        <p className="scoring-wait-stage">{STAGES[stage]}</p>
        <p className="muted mt-3 text-sm leading-6">
          Speaking recordings are transcribed first, then writing and speaking are scored. This usually takes
          one to three minutes. Do not close this page.
        </p>
        <p className="muted mt-4 text-sm">Elapsed {minutes}:{seconds}</p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {elapsed >= 90 && (
          <div className="mt-5">
            <GhostButton disabled={retrying} onClick={() => void retry()}>
              {retrying ? "Retrying…" : "Retry scoring"}
            </GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}
