"use client";

import type { ReactNode } from "react";
import type { AttemptAnalysis } from "@/lib/library-analysis";
import { formatSpent } from "@/lib/timing-log";
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

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function fill(ratio: number) {
  return `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`;
}

export function LibraryOverview({ forms }: { forms: DashboardForm[] }) {
  const completed = forms
    .flatMap((form) => form.attempts)
    .filter((attempt) => attempt.status === "completed" && attempt.analysis)
    .sort((a, b) => +new Date(a.completedAt || a.createdAt) - +new Date(b.completedAt || b.createdAt));
  if (!completed.length) {
    return (
      <section className="panel mb-8 p-6">
        <h2 className="text-xl font-semibold">Results dashboard</h2>
        <p className="mt-2 text-sm leading-6 text-[#5b6775]">
          After you finish a test, this page shows bands, classic 0–30 scores, module accuracy, task breakdowns, writing
          notes, speaking scores, and timing for every sitting.
        </p>
      </section>
    );
  }

  const latest = completed[completed.length - 1];
  const sectionAvgs = Object.fromEntries(
    SECTIONS.map((section) => [
      section,
      mean(completed.map((attempt) => attempt.analysis?.bands?.[section]).filter((value): value is number => value != null)),
    ]),
  ) as Record<(typeof SECTIONS)[number], number | null>;
  const sectionBests = Object.fromEntries(
    SECTIONS.map((section) => [
      section,
      completed.reduce<number | null>((best, attempt) => {
        const value = attempt.analysis?.bands?.[section];
        if (value == null) return best;
        return best == null ? value : Math.max(best, value);
      }, null),
    ]),
  ) as Record<(typeof SECTIONS)[number], number | null>;
  const overalls = completed.map((attempt) => attempt.analysis?.bands?.overall).filter((value): value is number => value != null);
  const scores120 = completed.map((attempt) => attempt.analysis?.overall120).filter((value): value is number => value != null);
  const ranked = SECTIONS.map((section) => ({ section, value: sectionAvgs[section] })).filter(
    (row): row is { section: (typeof SECTIONS)[number]; value: number } => row.value != null,
  );
  const strongest = [...ranked].sort((a, b) => b.value - a.value)[0];
  const weakest = [...ranked].sort((a, b) => a.value - b.value)[0];
  const trend = completed.slice(-8);

  return (
    <section className="mb-8 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Results dashboard</h2>
        <p className="mt-1 text-sm text-[#5b6775]">
          {completed.length} completed sitting{completed.length === 1 ? "" : "s"} · Latest overall{" "}
          <Band value={latest.analysis?.bands?.overall} />
          {latest.analysis?.overall120 != null ? ` · ≈ ${latest.analysis.overall120} / 120` : ""} · Best{" "}
          <Band value={overalls.length ? Math.max(...overalls) : null} />
          {scores120.length ? ` · Best ≈ ${Math.max(...scores120)} / 120` : ""}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SECTIONS.map((section) => (
          <div key={section} className="panel p-4">
            <div className="text-xs uppercase tracking-wide text-[#5b6775]">{section}</div>
            <div className="mt-1 text-2xl">
              <Band value={sectionAvgs[section]} />
            </div>
            <p className="mt-1 text-xs text-[#5b6775]">
              Average band · Best <Band value={sectionBests[section]} />
            </p>
            <p className="mt-1 text-sm font-semibold text-[#1f4e79]">
              Latest CEFR {latest.analysis?.cefr?.[section] || "—"}
              {latest.analysis?.classic30?.[section] != null
                ? ` · Classic ${latest.analysis.classic30[section]}`
                : ""}
            </p>
            <div className="score-bar mt-3">
              <span style={{ width: fill((sectionAvgs[section] || 0) / 6) }} />
            </div>
          </div>
        ))}
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-wide text-[#5b6775]">Overall</div>
          <div className="mt-1 text-2xl">
            <Band value={mean(overalls)} />
          </div>
          <p className="mt-1 text-xs text-[#5b6775]">Average 1–6 band across sittings</p>
          <p className="mt-1 text-sm font-semibold text-[#1f4e79]">
            Latest CEFR {latest.analysis?.cefr?.overall || "—"}
            {latest.analysis?.overall120 != null ? ` · ≈ ${latest.analysis.overall120}` : ""}
          </p>
          <div className="score-bar mt-3">
            <span style={{ width: fill((mean(overalls) || 0) / 6) }} />
          </div>
        </div>
      </div>
      <div className="panel grid gap-4 p-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">What the averages say</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
            {strongest && <li>Strongest section on average: {strongest.section} ({strongest.value.toFixed(1)}).</li>}
            {weakest && strongest && weakest.section !== strongest.section && (
              <li>Needs the most work: {weakest.section} ({weakest.value.toFixed(1)}).</li>
            )}
            {latest.analysis?.insights.slice(0, 3).map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>These are mock estimates, not official ETS scores.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Recent sittings</h3>
          <div className="mt-3 flex h-16 items-end gap-1">
            {trend.map((attempt) => {
              const value = attempt.analysis?.bands?.overall || 0;
              return (
                <div
                  key={attempt.id}
                  className="flex-1 rounded-t bg-[#1f4e79]"
                  style={{ height: fill(value / 6) }}
                  title={`${new Date(attempt.completedAt || attempt.createdAt).toLocaleDateString()} · ${value.toFixed(1)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#5b6775]">
            <span>{new Date(trend[0].completedAt || trend[0].createdAt).toLocaleDateString()}</span>
            <span>1–6 band</span>
            <span>{new Date(trend[trend.length - 1].completedAt || trend[trend.length - 1].createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AttemptAnalysisCard({ attempt }: { attempt: DashboardAttempt }) {
  const analysis = attempt.analysis;
  if (!analysis) return null;
  const bands = analysis.bands || {};
  return (
    <div className="mt-4 space-y-4 border-t border-[#e4e9ee] pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-semibold capitalize">
            {attempt.mode} · {attempt.scopeLabel}
          </p>
          <p className="text-xs text-[#5b6775]">
            Started {new Date(attempt.createdAt).toLocaleString()}
            {attempt.completedAt ? ` · Finished ${new Date(attempt.completedAt).toLocaleString()}` : ""}
            {analysis.totalMs ? ` · Timed work ${formatSpent(analysis.totalMs)}` : ""}
          </p>
        </div>
        <p className="text-sm">
          Overall <Band value={bands.overall} />
          {analysis.cefr?.overall ? ` · ${analysis.cefr.overall}` : ""}
          {analysis.overall120 != null ? ` · ≈ ${analysis.overall120} / 120` : ""}
          {analysis.projectedOverall != null ? (
            <>
              {" "}
              · Projected <Band value={analysis.projectedOverall} />
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => (
          <div key={section} className="rounded border border-[#e4e9ee] p-3">
            <div className="text-xs uppercase text-[#5b6775]">{section}</div>
            <div className="text-xl">
              <Band value={bands[section]} />
              <span className="ml-2 text-sm text-[#5b6775]">{analysis.cefr?.[section] || ""}</span>
            </div>
            <p className="text-sm font-semibold text-[#1f4e79]">
              Classic 0–30: {analysis.classic30?.[section] ?? "—"}
            </p>
            <RawLine section={section} analysis={analysis} />
            <div className="score-bar mt-2">
              <span style={{ width: fill((bands[section] || 0) / 6) }} />
            </div>
          </div>
        ))}
      </div>

      {analysis.modules.length > 0 && (
        <Block title="Module accuracy">
          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.modules.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="font-semibold">
                  {row.correct}/{row.possible}
                  {row.possible ? ` · ${Math.round((100 * row.correct) / row.possible)}%` : ""}
                </span>
              </div>
            ))}
          </div>
        </Block>
      )}

      {analysis.tasks.length > 0 && (
        <Block title="Task breakdown">
          <div className="grid gap-2 md:grid-cols-2">
            {analysis.tasks.map((task) => {
              const ratio =
                task.possible && task.possible > 0
                  ? (task.correct || 0) / task.possible
                  : task.max
                    ? (task.score || 0) / task.max
                    : 0;
              return (
                <div key={task.id}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{task.label}</span>
                    <span className="font-semibold">{task.detail}</span>
                  </div>
                  <div className="score-bar mt-1">
                    <span style={{ width: fill(ratio) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {(analysis.writing.email || analysis.writing.discussion) && (
        <Block title="Writing notes">
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.writing.email && <WritingNoteCard title="Email" note={analysis.writing.email} />}
            {analysis.writing.discussion && <WritingNoteCard title="Discussion" note={analysis.writing.discussion} />}
          </div>
        </Block>
      )}

      {(analysis.speaking.repeats.length > 0 || analysis.speaking.interviews.length > 0) && (
        <Block title="Speaking notes">
          {analysis.speaking.repeats.length > 0 && (
            <div className="mb-3">
              <p className="text-sm">
                Listen and Repeat
                {analysis.speaking.avgWer != null
                  ? ` · average word-error rate ${Math.round(analysis.speaking.avgWer * 100)}%`
                  : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.speaking.repeats.map((row, index) => (
                  <span key={`rep-${index}`} className="rounded bg-[#e8f1fb] px-2 py-1 text-xs font-semibold">
                    {index + 1}: {row.score}/5
                    {row.wer != null ? ` · ${Math.round(row.wer * 100)}% WER` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
          {analysis.speaking.interviews.length > 0 && (
            <div>
              <p className="text-sm">Interview (fact → reaction → opinion → policy)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysis.speaking.interviews.map((row, index) => (
                  <span key={`int-${index}`} className="rounded bg-[#e8f1fb] px-2 py-1 text-xs font-semibold">
                    Q{index + 1}: {row.score}/5
                  </span>
                ))}
              </div>
              {analysis.speaking.interviews.find((row) => row.improve)?.improve && (
                <p className="mt-2 text-sm text-[#5b6775]">
                  {analysis.speaking.interviews.find((row) => row.improve)?.improve}
                </p>
              )}
            </div>
          )}
        </Block>
      )}

      {analysis.timing.length > 0 && (
        <Block title="Time on each part">
          <div className="space-y-1 text-sm">
            {analysis.timing.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <span>{row.label}</span>
                <span className="font-medium">
                  {formatSpent(row.ms)}
                  {row.limitMs ? ` / ${formatSpent(row.limitMs)} official` : ""}
                </span>
              </div>
            ))}
          </div>
        </Block>
      )}

      {analysis.insights.length > 0 && (
        <Block title="Takeaways">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            {analysis.insights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function RawLine({
  section,
  analysis,
}: {
  section: (typeof SECTIONS)[number];
  analysis: AttemptAnalysis;
}) {
  const raw = analysis.raw;
  if (section === "reading" && raw?.reading) {
    return (
      <p className="text-xs text-[#5b6775]">
        {raw.reading.correct}/{raw.reading.possible} correct · scaled {Math.round(raw.reading.scaled)} · {raw.reading.route} route
      </p>
    );
  }
  if (section === "listening" && raw?.listening) {
    return (
      <p className="text-xs text-[#5b6775]">
        {raw.listening.correct}/{raw.listening.possible} correct · scaled {Math.round(raw.listening.scaled)} ·{" "}
        {raw.listening.route} route
      </p>
    );
  }
  if (section === "writing" && raw?.writing) {
    return (
      <p className="text-xs text-[#5b6775]">
        Sentences {raw.writing.sentence}/10 · Email {raw.writing.email}/5 · Discussion {raw.writing.discussion}/5
      </p>
    );
  }
  if (section === "speaking" && raw?.speaking) {
    return (
      <p className="text-xs text-[#5b6775]">
        Repeat {raw.speaking.repeat} · Interview {raw.speaking.interview} · Total {raw.speaking.total}/55
      </p>
    );
  }
  return <p className="text-xs text-[#5b6775]">Not on this sitting</p>;
}

function WritingNoteCard({ title, note }: { title: string; note: NonNullable<AttemptAnalysis["writing"]["email"]> }) {
  return (
    <div className="rounded border border-[#e4e9ee] p-3 text-sm">
      <p className="font-semibold">
        {title}: {note.score}/5
      </p>
      {note.reason && <p className="mt-1 leading-6 text-[#5b6775]">{note.reason}</p>}
      {note.issues.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[#7f1d1d]">
          {note.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-[#e4e9ee] p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
