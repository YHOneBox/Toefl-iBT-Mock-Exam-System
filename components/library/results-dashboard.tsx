"use client";

import type { AttemptAnalysis } from "@/lib/library-analysis";
import type { SectionName } from "@/lib/types";
import { Band } from "../ui";
import { SECTION_ORDER, SECTION_UI } from "./section-marks";

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
  scope?: string[];
  scopeLabel?: string;
  subjects?: string[];
  subjectsLabel?: string;
  difficulty?: string;
  latestOverall: number | null;
  bestOverall: number | null;
  attempts: DashboardAttempt[];
};

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sectionScores(attempt: DashboardAttempt) {
  return attempt.analysis?.bands || attempt.bands || {};
}

export function LibraryOverview({
  forms,
  filter = "all",
  onFilter,
  onPracticeSection,
}: {
  forms: DashboardForm[];
  filter?: SectionName | "all";
  onFilter?: (section: SectionName | "all") => void;
  onPracticeSection?: (section: SectionName) => void;
}) {
  const completed = forms
    .flatMap((form) => form.attempts)
    .filter((attempt) => attempt.status === "completed" && (attempt.analysis || attempt.bands))
    .sort((a, b) => +new Date(a.completedAt || a.createdAt) - +new Date(b.completedAt || b.createdAt));
  const latest = completed[completed.length - 1];
  const latestBands = latest ? sectionScores(latest) : {};
  const sectionAvgs = Object.fromEntries(
    SECTION_ORDER.map((section) => [
      section,
      mean(
        completed
          .map((attempt) => sectionScores(attempt)[section])
          .filter((value): value is number => value != null),
      ),
    ]),
  ) as Record<SectionName, number | null>;
  const overalls = completed
    .map((attempt) => sectionScores(attempt).overall)
    .filter((value): value is number => value != null);
  const overall = mean(overalls) ?? latestBands.overall ?? null;

  return (
    <section className="library-cats">
      <div className="library-cats-head">
        <h2>Sections</h2>
        <p className="library-overall">
          Overall{" "}
          <strong>{overall == null ? "—" : overall.toFixed(1).replace(/\.0$/, "")}</strong>
        </p>
      </div>
      <div className="cat-grid">
        {SECTION_ORDER.map((section) => {
          const meta = SECTION_UI[section];
          const avg = sectionAvgs[section];
          const active = filter === section;
          return (
            <article
              key={section}
              className={`cat-card cat-card-${section}${active ? " is-active" : ""}${filter !== "all" && !active ? " is-dim" : ""}`}
            >
              <button
                type="button"
                className="cat-card-hit"
                onClick={() => onFilter?.(active ? "all" : section)}
              >
                <span className="cat-letter" aria-hidden>
                  {meta.letter}
                </span>
                <span className="cat-card-copy">
                  <strong>{meta.name}</strong>
                  <span className="score-figure">
                    <Band value={avg} />
                  </span>
                </span>
              </button>
              {onPracticeSection && (
                <button type="button" className="cat-practice" onClick={() => onPracticeSection(section)}>
                  Practice
                </button>
              )}
            </article>
          );
        })}
      </div>
      {filter !== "all" && (
        <button type="button" className="library-clear" onClick={() => onFilter?.("all")}>
          Show all papers
        </button>
      )}
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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {SECTION_ORDER.map((section) => {
          const meta = SECTION_UI[section];
          return (
            <div key={section} className={`panel score-card score-card-${section} p-3`}>
              <div className="muted text-xs font-bold uppercase tracking-wide">
                {meta.letter} · {meta.name}
              </div>
              <div className="score-figure text-xl">
                <Band value={bands[section]} />
              </div>
            </div>
          );
        })}
        <div className="panel score-card score-card-overall p-3">
          <div className="muted text-xs font-bold uppercase tracking-wide">Overall</div>
          <div className="score-figure text-xl">
            <Band value={bands.overall} />
          </div>
        </div>
      </div>
    </div>
  );
}
