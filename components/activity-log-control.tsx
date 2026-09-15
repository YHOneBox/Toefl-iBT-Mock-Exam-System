"use client";

import { useEffect, useState } from "react";
import { appPath } from "@/lib/base-path";

type ActivityEntry = {
  id: string;
  at: string;
  kind: "generate" | "exam" | "account";
  title: string;
  detail?: string;
};

const KIND_LABEL: Record<ActivityEntry["kind"], string> = {
  generate: "Generation",
  exam: "Test",
  account: "Account",
};

export function ActivityLogControl() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    fetch(appPath("/api/auth/me"), { cache: "no-store", credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { user?: { id?: string } | null }) => setSignedIn(Boolean(data.user?.id)))
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    if (!open || !signedIn) return;
    let cancelled = false;
    async function load() {
      const res = await fetch(appPath("/api/activity"), { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: ActivityEntry[] };
      if (!cancelled) setEntries(Array.isArray(data.entries) ? data.entries : []);
    }
    void load();
    const timer = window.setInterval(() => void load(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, signedIn]);

  if (!signedIn) return null;

  return (
    <>
      <button type="button" className="app-log-btn" onClick={() => setOpen(true)}>
        Show log
      </button>
      {open && (
        <div className="app-log-overlay" role="dialog" aria-label="Activity log">
          <div className="app-log-panel">
            <div className="app-log-panel-head">
              <div>
                <p className="app-log-panel-kicker">Activity</p>
                <h2>Show log</h2>
              </div>
              <button type="button" className="ui-btn ui-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="muted app-log-panel-note">
              Generation and sitting events. Review scores and answer sheets are not stored here.
            </p>
            <ol className="app-log-list">
              {entries.length === 0 && <li className="muted">No events yet.</li>}
              {entries.map((entry) => (
                <li key={entry.id}>
                  <div className="app-log-meta">
                    <span className={`app-log-kind app-log-kind-${entry.kind}`}>{KIND_LABEL[entry.kind]}</span>
                    <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                  </div>
                  <p className="app-log-title">{entry.title}</p>
                  {entry.detail && <p className="muted app-log-detail">{entry.detail}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
