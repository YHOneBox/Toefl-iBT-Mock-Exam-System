"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GhostButton, PrimaryButton } from "../ui";

type Model = {
  id: string;
  displayName: string;
  description: string;
  recommended: boolean;
  reason: string;
};

type Settings = {
  chain: string[];
  available?: Model[];
  scannedAt?: string | null;
  lastUsed?: string | null;
  lastError?: string | null;
};

export function GeminiSettings() {
  const [models, setModels] = useState<Model[]>([]);
  const [chain, setChain] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyPresent, setKeyPresent] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [homeHref, setHomeHref] = useState("/");

  useEffect(() => {
    void loadSaved();
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { isAdmin?: boolean }) => {
        if (data.isAdmin) setHomeHref("/users");
      })
      .catch(() => undefined);
  }, []);

  function applySettings(next: Settings | null | undefined, fallbackModels?: Model[]) {
    if (!next) return;
    setSettings(next);
    setChain(next.chain || []);
    const stored = next.available?.length ? next.available : fallbackModels;
    if (stored?.length) setModels(stored);
  }

  async function loadSaved() {
    const res = await fetch("/api/llm/settings", { cache: "no-store" });
    const data = (await res.json()) as { settings?: Settings; keyPresent?: boolean };
    setKeyPresent(Boolean(data.keyPresent));
    applySettings(data.settings);
    if (data.settings?.available?.length) {
      setStatus(
        `Loaded ${data.settings.available.length} stored models${
          data.settings.scannedAt ? ` · scanned ${new Date(data.settings.scannedAt).toLocaleString()}` : ""
        }.`,
      );
    }
  }

  async function scan() {
    setScanning(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/llm/models", { cache: "no-store" });
      const data = (await res.json()) as {
        models?: Model[];
        settings?: Settings;
        suggested?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Scan failed");
      applySettings(data.settings, data.models);
      const next =
        data.settings?.chain?.filter((id) => (data.models || []).some((m) => m.id === id)) || [];
      setChain(next.length ? next : data.suggested || []);
      setStatus(`Found and stored ${(data.models || []).length} usable Gemini models.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function toggle(id: string) {
    setChain((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setChain((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setChain((prev) => {
      const from = prev.indexOf(dragId);
      const to = prev.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      void persist(copy);
      return copy;
    });
    setDragId(null);
  }

  async function persist(nextChain: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/llm/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: nextChain }),
      });
      const data = (await res.json()) as { settings?: Settings; error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      applySettings(data.settings);
      setStatus("Available models and fallback order are stored. Timeouts and quota errors will try the next model.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    await persist(chain);
  }

  const selectedModels = chain.map(
    (id) =>
      models.find((m) => m.id === id) || {
        id,
        displayName: id,
        recommended: false,
        reason: "Saved in fallback chain",
        description: "",
      },
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gemini model fallback</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b6775]">
            Scanned models and the fallback order are both stored. Drag rows to change try order. If a model
            hits a timeout, quota, or rate limit, the next selected model is used. OpenAI remains the last
            fallback if it is configured.
          </p>
        </div>
        <Link href={homeHref} className="rounded border px-3 py-2 text-sm">
          {homeHref === "/users" ? "Accounts" : "Main page"}
        </Link>
      </div>

      {!keyPresent && (
        <div className="panel mb-4 p-4 text-sm text-red-800">
          GEMINI_API_KEY is missing in .env. Add it, restart the app, then scan.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <PrimaryButton disabled={scanning || !keyPresent} onClick={() => void scan()}>
          {scanning ? "Scanning…" : "Scan available models"}
        </PrimaryButton>
        <GhostButton disabled={saving || chain.length === 0} onClick={() => void save()}>
          {saving ? "Saving…" : "Save fallback order"}
        </GhostButton>
      </div>

      {status && <p className="mb-3 text-sm text-[#1f4e79]">{status}</p>}
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      {settings?.lastUsed && (
        <p className="mb-3 text-sm text-[#5b6775]">
          Last used: {settings.lastUsed}
          {settings.lastError ? ` · Last error: ${settings.lastError}` : ""}
        </p>
      )}
      {settings?.scannedAt && (
        <p className="mb-3 text-sm text-[#5b6775]">
          Stored available models: {settings.available?.length || 0} · last scan{" "}
          {new Date(settings.scannedAt).toLocaleString()}
        </p>
      )}

      {chain.length > 0 && (
        <div className="panel mb-6 p-4">
          <h2 className="mb-2 font-semibold">Fallback order</h2>
          <p className="mb-3 text-xs text-[#5b6775]">Drag a row to reorder, or use Up / Down.</p>
          <ol className="space-y-2">
            {selectedModels.map((model, i) => (
              <li
                key={model.id}
                draggable
                onDragStart={() => setDragId(model.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(model.id)}
                onDragEnd={() => setDragId(null)}
                className={`flex cursor-grab items-center justify-between gap-3 rounded border bg-white px-3 py-2 text-sm active:cursor-grabbing ${
                  dragId === model.id ? "border-[#1f4e79] bg-[#e8f1fb]" : "border-[#d5dbe3]"
                }`}
              >
                <div>
                  <span className="mr-2 text-[#5b6775]">{i + 1}.</span>
                  <span className="mr-2 text-[#9aa8b5]">⋮⋮</span>
                  {model.displayName} <span className="text-[#5b6775]">({model.id})</span>
                </div>
                <div className="flex gap-2">
                  <GhostButton onClick={() => move(model.id, -1)}>Up</GhostButton>
                  <GhostButton onClick={() => move(model.id, 1)}>Down</GhostButton>
                  <GhostButton onClick={() => toggle(model.id)}>Remove</GhostButton>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {models.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Stored usable models</h2>
          {models.map((model) => (
            <label key={model.id} className="panel flex items-start gap-3 p-3 text-sm">
              <input
                type="checkbox"
                checked={chain.includes(model.id)}
                onChange={() => toggle(model.id)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">
                  {model.displayName}
                  {model.recommended ? (
                    <span className="ml-2 text-xs uppercase text-[#1f4e79]">Recommended</span>
                  ) : null}
                </div>
                <div className="text-[#5b6775]">{model.id}</div>
                <div className="mt-1 text-[#5b6775]">{model.reason}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
