import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CompareApp } from "@/components/review/compare-app";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export default async function ComparePage() {
  const user = await getCurrentUser();
  if (isAdminUser(user)) redirect("/users");
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="muted">Loading…</p>
        </AppShell>
      }
    >
      <CompareApp />
    </Suspense>
  );
}
