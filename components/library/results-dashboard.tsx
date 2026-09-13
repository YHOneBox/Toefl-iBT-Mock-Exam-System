"use client";

import type { AttemptAnalysis } from "@/lib/library-analysis";
import { Band } from "../ui";

export type DashboardAttempt = {
  id: string;
  mode: string;
  scopeLabel: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  bands: Record<string, number> | null;
  classic30: Record<string, number | undefined> | null;
  analysis: AttemptAnalysis | null;
};

export type DashboardForm = {
  id: string;
  createdAt: string;
  topics: string[];
  difficulty?: string;
  latestOverall: number | null;
  bestOverall: number | null;
  attempts: DashboardAttempt[];
};

const SECTIONS = ["reading", "listening", "writing", "speaking"] as const;

function scoreCardClass(section: string) {
  return `panel score-card score-card-${section}`;
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function fill(ratio: number) {
  return `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`;
}

function sectionScores(attempt: DashboardAttempt) {
  return attempt.analysis?.bands || attempt.bands || {};
}

export function LibraryOverview({ forms }: { forms: DashboardForm[] }) {
  const completed = forms
    .flatMap((form) => form.attempts)
    .filter((attempt) => attempt.status === "completed" && (attempt.analysis || attempt.bands))
    .sort((a, b) => +new Date(a.completedAt || a.createdAt) - +new Date(b.completedAt || b.createdAt));
  if (!completed.length) {
    return (
      <section className="panel mb-8 p-6">
        <h2 className="text-xl font-semibold">Results dashboard</h2>
        <p className="muted mt-2 text-sm leading-6">
          After you finish a test, this page lists section scores. Open a sitting for the full review.
        </p>
      </section>
    );
  }

  const latest = completed[completed.length - 1];
  const latestBands = sectionScores(latest);
  const sectionAvgs = Object.fromEntries(
    SECTIONS.map((section) => [
      section,
      mean(
        completed
          .map((attempt) => sectionScores(attempt)[section])
          .filter((value): value is number => value != null),
      ),
    ]),
  ) as Record<(typeof SECTIONS)[number], number | null>;
  const overalls = completed
    .map((attempt) => sectionScores(attempt).overall)
    .filter((value): value is number => value != null);

  return (
    <section className="mb-8 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Results dashboard</h2>
        <p className="muted mt-1 text-sm">
          Average bands across {completed.length} completed sitting{completed.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SECTIONS.map((section) => (
          <div key={section} className={`${scoreCardClass(section)} p-4`}>
            <div className="muted text-xs uppercase tracking-wide">{section}</div>
            <div className="score-figure mt-1 text-2xl">
              <Band value={sectionAvgs[section]} />
            </div>
            <div className="score-bar mt-3">
              <span style={{ width: fill((sectionAvgs[section] || 0) / 6) }} />
            </div>
          </div>
        ))}
        <div className={`${scoreCardClass("overall")} p-4`}>
          <div className="muted text-xs uppercase tracking-wide">Overall</div>
          <div className="score-figure mt-1 text-2xl">
            <Band value={mean(overalls) ?? latestBands.overall} />
          </div>
          <div className="score-bar mt-3">
            <span style={{ width: fill((mean(overalls) || latestBands.overall || 0) / 6) }} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function AttemptScoreSummary({ attempt }: { attempt: DashboardAttempt }) {
  const bands = sectionScores(attempt);
  return (
    <div className="mt-3">
      <p className="muted mb-2 text-xs capitalize">
        {attempt.mode} · {attempt.scopeLabel} · {new Date(attempt.completedAt || attempt.createdAt).toLocaleString()}
      </p>
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-5">
        {SECTIONS.map((section) => (
          <div key={section} className={`${scoreCardClass(section)} p-3`}>
            <div className="muted text-xs uppercase">{section}</div>
            <div className="score-figure text-xl">
              <Band value={bands[section]} />
            </div>
          </div>
        ))}
        <div className={`${scoreCardClass("overall")} p-3`}>
          <div className="muted text-xs uppercase">Overall</div>
          <div className="score-figure text-xl">
            <Band value={bands.overall} />
          </div>
        </div>
      </div>
    </div>
  );
}
