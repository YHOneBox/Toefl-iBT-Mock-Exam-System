"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ClientSession } from "@/lib/client-types";
import { AppShell } from "../app-shell";
import { Band } from "../ui";

function CompareFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      nav={
        <Link href="/" className="ui-link">
          Main page
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}

export function CompareApp() {
  const params = useSearchParams();
  const a = params.get("a");
  const b = params.get("b");
  const [data, setData] = useState<{ left: ClientSession; right: ClientSession } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!a || !b) return;
    fetch(`/api/compare?a=${a}&b=${b}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((e) => setError(String(e)));
  }, [a, b]);

  if (!a || !b) return <CompareFrame><p>Choose two attempts to compare.</p></CompareFrame>;
  if (error) return <CompareFrame><p>{error}</p></CompareFrame>;
  if (!data) return <CompareFrame><p className="muted">Loading comparison…</p></CompareFrame>;

  const leftBands = data.left.scoreReport?.bands || {};
  const rightBands = data.right.scoreReport?.bands || {};
  const ids = Array.from(
    new Set([...Object.keys(data.left.responses), ...Object.keys(data.right.responses)]),
  );

  return (
    <CompareFrame>
      <h1 className="mb-6 text-2xl font-semibold">Compare attempts</h1>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Side label="Attempt A" session={data.left} bands={leftBands} />
        <Side label="Attempt B" session={data.right} bands={rightBands} />
      </div>
      <div className="space-y-2">
        {ids.map((id) => {
          const l = stringify(data.left.responses[id]?.value);
          const r = stringify(data.right.responses[id]?.value);
          const flip = l !== r;
          return (
            <div key={id} className={`panel p-3 text-sm ${flip ? "border-[#f59e0b]" : ""}`}>
              <div className="muted mb-1 font-mono text-xs">{id}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>{l || "—"}</div>
                <div>{r || "—"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </CompareFrame>
  );
}

function Side({
  label,
  session,
  bands,
}: {
  label: string;
  session: ClientSession;
  bands: Record<string, number | undefined>;
}) {
  return (
    <div className="panel p-5">
      <div className="font-semibold">{label}</div>
      <div className="muted text-sm">{new Date(session.createdAt).toLocaleString()}</div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="chip chip-reading">R <Band value={bands.reading} /></span>
        <span className="chip chip-listening">L <Band value={bands.listening} /></span>
        <span className="chip chip-writing">W <Band value={bands.writing} /></span>
        <span className="chip chip-speaking">S <Band value={bands.speaking} /></span>
        <span className="chip chip-overall">Overall <Band value={bands.overall} /></span>
      </div>
    </div>
  );
}

function stringify(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
