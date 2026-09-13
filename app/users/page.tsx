"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GhostButton, PrimaryButton } from "@/components/ui";
import { appPath } from "@/lib/base-path";

type UserRow = {
  id: string;
  username: string;
  createdAt: string;
  isAdmin?: boolean;
  testCount?: number;
  attemptCount?: number;
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteFor, setDeleteFor] = useState<string | null>(null);

  async function load() {
    const me = (await fetch(appPath("/api/auth/me"), { cache: "no-store" }).then((r) => r.json())) as {
      isAdmin?: boolean;
    };
    if (!me.isAdmin) {
      setAllowed(false);
      router.replace("/");
      return;
    }
    setAllowed(true);
    const res = await fetch(appPath("/api/users"), { cache: "no-store" });
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
      const res = await fetch(appPath("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not create user");
      setUsername("");
      setPassword("");
      setStatus("Account created. That person can sign in and will have a separate library.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(user: UserRow) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (newPassword.length < 4) throw new Error("Password must be at least 4 characters");
      if (newPassword !== confirmPassword) throw new Error("The two passwords do not match");
      const res = await fetch(appPath(`/api/users/${user.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not change password");
      setPasswordFor(null);
      setNewPassword("");
      setConfirmPassword("");
      setStatus(
        user.isAdmin
          ? "Admin password updated. Stay signed in on this browser."
          : `Password updated for ${user.username}. They will need to sign in again.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: UserRow) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(appPath(`/api/users/${user.id}`), { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not delete user");
      setDeleteFor(null);
      setStatus(`${user.username} and their tests were deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === false) {
    return (
      <AppShell brandHref="/users">
        <p>Only the admin account can manage users.</p>
      </AppShell>
    );
  }
  if (allowed === null) {
    return (
      <AppShell brandHref="/users">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      brandHref="/users"
      nav={
        <>
          <Link href="/settings" className="ui-link">
            Gemini models
          </Link>
          <GhostButton
            onClick={() => {
              void fetch(appPath("/api/auth/logout"), { method: "POST" }).then(() => {
                window.location.href = appPath("/login");
              });
            }}
          >
            Sign out
          </GhostButton>
        </>
      }
    >
      <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="muted mt-2 text-sm leading-6">
          The admin account only manages users. Create accounts, change passwords (including admin), or delete a
          student and their tests. Admin cannot take a mock test.
        </p>
      </div>

      <form
        className="panel mb-6 space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <h2 className="font-semibold">Create user</h2>
        <label className="block text-sm">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field mt-1"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1"
            autoComplete="new-password"
          />
        </label>
        <PrimaryButton type="submit" disabled={busy || username.trim().length < 2 || password.length < 4}>
          {busy ? "Saving…" : "Create user"}
        </PrimaryButton>
      </form>

      {(error || status) && (
        <div className="mb-4 text-sm">
          {error && <p className="text-red-700">{error}</p>}
          {status && <p className="text-[#0f766e]">{status}</p>}
        </div>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="panel space-y-3 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">
                  {user.username}
                  {user.isAdmin ? <span className="ml-2 text-xs font-bold uppercase text-[#c2410c]">Admin</span> : null}
                </div>
                <div className="muted mt-1">
                  {user.isAdmin
                    ? "Password only — this account cannot be deleted"
                    : `${user.testCount ?? 0} tests · ${user.attemptCount ?? 0} attempts`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <GhostButton
                  disabled={busy}
                  onClick={() => {
                    setDeleteFor(null);
                    setPasswordFor(passwordFor === user.id ? null : user.id);
                    setNewPassword("");
                    setConfirmPassword("");
                    setError(null);
                    setStatus(null);
                  }}
                >
                  Change password
                </GhostButton>
                {!user.isAdmin && (
                  <GhostButton
                    disabled={busy}
                    onClick={() => {
                      setPasswordFor(null);
                      setDeleteFor(deleteFor === user.id ? null : user.id);
                      setError(null);
                      setStatus(null);
                    }}
                  >
                    Delete
                  </GhostButton>
                )}
              </div>
            </div>

            {passwordFor === user.id && (
              <form
                className="space-y-2 border-t border-[#d5dbe3] pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void changePassword(user);
                }}
              >
                <label className="block">
                  New password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field mt-1"
                    autoComplete="new-password"
                  />
                </label>
                <label className="block">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="field mt-1"
                    autoComplete="new-password"
                  />
                </label>
                <PrimaryButton type="submit" disabled={busy || newPassword.length < 4}>
                  Save password
                </PrimaryButton>
              </form>
            )}

            {deleteFor === user.id && (
              <div className="space-y-2 border-t border-[#d5dbe3] pt-3">
                <p>
                  Delete <strong>{user.username}</strong> and all of their tests, scores, and recordings? This cannot be
                  undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeUser(user)}
                    className="rounded bg-[#9b2c2c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Delete account
                  </button>
                  <GhostButton disabled={busy} onClick={() => setDeleteFor(null)}>
                    Cancel
                  </GhostButton>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </AppShell>
  );
}
