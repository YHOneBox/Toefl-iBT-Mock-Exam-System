"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ClientSession } from "@/lib/client-types";
import { Band } from "../ui";

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

  if (!a || !b) return <div className="p-8">Choose two attempts to compare.</div>;
  if (error) return <div className="p-8">{error}</div>;
  if (!data) return <div className="p-8">Loading comparison…</div>;

  const leftBands = data.left.scoreReport?.bands || {};
  const rightBands = data.right.scoreReport?.bands || {};
  const ids = Array.from(
    new Set([...Object.keys(data.left.responses), ...Object.keys(data.right.responses)]),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Compare attempts</h1>
      <div className="panel mb-6 grid gap-4 p-5 md:grid-cols-2">
        <Side label="Attempt A" session={data.left} bands={leftBands} />
        <Side label="Attempt B" session={data.right} bands={rightBands} />
      </div>
      <div className="space-y-2">
        {ids.map((id) => {
          const l = stringify(data.left.responses[id]?.value);
          const r = stringify(data.right.responses[id]?.value);
          const flip = l !== r;
          return (
            <div key={id} className={`panel p-3 text-sm ${flip ? "border-amber-400" : ""}`}>
              <div className="mb-1 font-mono text-xs text-[#5b6775]">{id}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>{l || "—"}</div>
                <div>{r || "—"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
    <div>
      <div className="font-semibold">{label}</div>
      <div className="text-sm text-[#5b6775]">{new Date(session.createdAt).toLocaleString()}</div>
      <div className="mt-2 text-sm">
        R <Band value={bands.reading} /> · L <Band value={bands.listening} /> · W <Band value={bands.writing} /> · S{" "}
        <Band value={bands.speaking} /> · Overall <Band value={bands.overall} />
      </div>
    </div>
  );
}

function stringify(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
