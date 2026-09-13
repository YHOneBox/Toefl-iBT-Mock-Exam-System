import { Suspense } from "react";
import { CompareApp } from "@/components/review/compare-app";

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <CompareApp />
    </Suspense>
  );
}
