"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrimaryButton } from "@/components/ui";
import { appPath } from "@/lib/base-path";

function LoginForm() {
  const params = useSearchParams();
  const rawNext = params.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(appPath("/api/auth/me"), { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { user?: { username: string } | null; userCount?: number; isAdmin?: boolean }) => {
        setUserCount(typeof data.userCount === "number" ? data.userCount : 1);
        if (data.isAdmin) window.location.replace(appPath("/users"));
        else if (data.user) window.location.replace(appPath(next));
      })
      .catch(() => setUserCount((current) => current ?? 1));
  }, [next]);

  async function submit(mode: "login" | "register") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(appPath(mode === "login" ? "/api/auth/login" : "/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as { error?: string; user?: { isAdmin?: boolean } };
      if (!res.ok) throw new Error(data.error || "Failed");
      const dest = appPath(data.user?.isAdmin ? "/users" : next);
      window.location.assign(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  const firstUser = userCount === 0;

  return (
    <AppShell>
      <div className="app-auth">
        <div className="app-auth-card">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">Local practice</p>
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className="muted mt-2 text-sm leading-6">
            {firstUser
              ? "Create the admin account first. After that, only admin can add other users."
              : "Open https://etnyhmac-mini.tail78f179.ts.net/toefl on phone and computer. Username is not case-sensitive."}
          </p>
          <form
            className="panel mt-6 space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(firstUser ? "register" : "login");
            }}
          >
            <label className="block text-sm">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="field mt-1"
                autoComplete="username"
                required
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field mt-1"
                autoComplete={firstUser ? "new-password" : "current-password"}
                required
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <PrimaryButton type="submit" disabled={busy || !username || !password}>
              {busy ? "Please wait…" : firstUser ? "Create first account" : "Sign in"}
            </PrimaryButton>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="muted">Loading…</p>
        </AppShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
