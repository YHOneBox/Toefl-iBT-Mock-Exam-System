import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CompareApp } from "@/components/review/compare-app";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export default async function ComparePage() {
  const user = await getCurrentUser();
  if (isAdminUser(user)) redirect("/users");
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <CompareApp />
    </Suspense>
  );
}
