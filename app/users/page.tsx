"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GhostButton, PrimaryButton } from "@/components/ui";

type UserRow = { id: string; username: string; createdAt: string; isAdmin?: boolean };

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  async function load() {
    const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()) as {
      isAdmin?: boolean;
    };
    if (!me.isAdmin) {
      setAllowed(false);
      router.replace("/");
      return;
    }
    setAllowed(true);
    const res = await fetch("/api/users", { cache: "no-store" });
    const data = (await res.json()) as { users?: UserRow[] };
    setUsers(data.users || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not create user");
      setUsername("");
      setPassword("");
      setStatus("Account created. That user can sign in and will have a separate library.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === false) return <div className="p-8">Only the admin account can manage users.</div>;
  if (allowed === null) return <div className="p-8">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6775]">
            Only admin can create accounts. Each person’s tests and scores stay in their own library.
          </p>
        </div>
        <Link href="/" className="rounded border px-3 py-2 text-sm">
          Main page
        </Link>
      </div>

      <form
        className="panel mb-6 space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="block text-sm">
          New username
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {status && <p className="text-sm text-[#1f4e79]">{status}</p>}
        <PrimaryButton type="submit" disabled={busy || username.trim().length < 2 || password.length < 4}>
          {busy ? "Creating…" : "Create user"}
        </PrimaryButton>
      </form>

      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className="panel flex items-center justify-between p-3 text-sm">
            <div className="font-medium">
              {user.username}
              {user.isAdmin ? <span className="ml-2 text-xs uppercase text-[#1f4e79]">Admin</span> : null}
            </div>
            <div className="text-[#5b6775]">{new Date(user.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <GhostButton onClick={() => (window.location.href = "/")}>Back</GhostButton>
      </div>
    </div>
  );
}
