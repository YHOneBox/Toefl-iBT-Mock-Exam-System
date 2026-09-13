"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { user?: { username: string } | null; userCount?: number; isAdmin?: boolean }) => {
        setUserCount(data.userCount ?? 0);
        if (data.isAdmin) router.replace("/users");
        else if (data.user) router.replace(next);
      })
      .catch(() => setUserCount(0));
  }, [next, router]);

  async function submit(mode: "login" | "register") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string; user?: { isAdmin?: boolean } };
      if (!res.ok) throw new Error(data.error || "Failed");
      router.replace(data.user?.isAdmin ? "/users" : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const firstUser = userCount === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">TOEFL iBT Mock</h1>
      <p className="mt-2 text-sm leading-6 text-[#5b6775]">
        {firstUser
          ? "Create the admin account first. After that, only admin can add other users."
          : "Sign in to open your own tests and scores. Ask admin if you need an account."}
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
            className="mt-1 w-full border px-3 py-2"
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
            className="mt-1 w-full border px-3 py-2"
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
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
