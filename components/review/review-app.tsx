"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientSession } from "@/lib/client-types";
import { flattenListeningItems, flattenReadingSets, listeningBundle, readingBundle } from "@/lib/form";
import { difficultyLabel } from "@/lib/generation/difficulty";
import { enabledSections } from "@/lib/scope";
import { classic30Scores } from "@/lib/scoring";
import { formatSpent, itemMs, officialLimit, parseTiming, partMs } from "@/lib/timing-log";
import type { RawScores, SectionName } from "@/lib/types";
import { appPath } from "@/lib/base-path";
import { AppShell } from "../app-shell";
import { Band, PrimaryButton } from "../ui";
import { VoiceControls } from "../voice/voice-context";
import type { WritingReviewFeedback } from "../tasks/writing";
import { AcademicTask, CompleteTheWordsTask, DailyLifeTask } from "../tasks/reading";
import { ListenChooseTask, SpokenSetTask } from "../tasks/listening";
import { DiscussionTaskView, EmailTaskView, SentenceBuilder } from "../tasks/writing";
import { InterviewTask, RepeatTask } from "../tasks/speaking";
import { ScoringWait } from "../exam/scoring-wait";

export function ReviewApp({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionName>("reading");

  useEffect(() => {
    if (session) window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    fetch(appPath(`/api/sessions/${sessionId}`))
      .then(async (r) => {
        const data = (await r.json()) as ClientSession & { error?: string };
        if (!r.ok || data.error || !data.form) throw new Error(data.error || "Could not load this review");
        const next = { ...data, timing: parseTiming(data.timing) };
        setSession(next);
        const parts = enabledSections(next.scope);
        if (parts[0]) setSection(parts[0]);
      })
      .catch((e) => setError(String(e)));
  }, [sessionId]);

  if (error) {
    return (
      <AppShell>
        <p>{error}</p>
      </AppShell>
    );
  }
  if (!session) {
    return (
      <AppShell>
        <p className="muted">Loading review…</p>
      </AppShell>
    );
  }
  if (session.status === "scoring" || session.currentPointer === "scoring") {
    return (
      <AppShell>
        <ScoringWait sessionId={sessionId} onComplete={setSession} />
      </AppShell>
    );
  }
  const bands = session.scoreReport?.bands || {};
  const concordance = session.scoreReport?.concordance as
    | {
        overall120?: number;
        projected120?: number;
        classic30?: Record<string, number | undefined>;
        cefr?: Record<string, string | null>;
        notes?: { method?: string };
      }
    | undefined;
  const traits = session.scoreReport?.traits as {
    traits?: Record<string, WritingReviewFeedback>;
    itemResults?: Record<string, SpeakingItemResult>;
  } | undefined;
  const classic =
    concordance?.classic30 || classic30Scores((session.scoreReport?.raw || {}) as RawScores);

  return (
    <AppShell
      nav={
        <Link href="/" className="ui-link">
          Main page
        </Link>
      }
    >
    <div className="review-page">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Score report</h1>
        <p className="muted text-sm">
          {session.topics.join(" · ")}
          {session.form.difficulty ? ` · ${difficultyLabel(session.form.difficulty)}` : ""}
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        {(["reading", "listening", "writing", "speaking", "overall"] as const).map((k) => {
          const selectable = k !== "overall" && enabledSections(session.scope).includes(k);
          const active = k === section;
          return (
            <button
              key={k}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && setSection(k)}
              className={`score-card score-card-${k} score-tile score-tile-${k} panel p-3 text-left ${
                active ? "is-active" : ""
              } ${selectable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="muted text-xs uppercase">{k}</div>
              <div className="score-figure text-2xl"><Band value={bands[k]} /></div>
              <div className="muted text-xs">{concordance?.cefr?.[k] || ""}</div>
              {k !== "overall" && (
                <div className="score-figure mt-1 text-sm font-semibold">
                  Classic 0–30: {classic[k] ?? "—"}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {enabledSections(session.scope).map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => setSection(part)}
            className={`section-tab section-tab-${part} ${section === part ? "is-active" : ""}`}
          >
            {part}
          </button>
        ))}
      </div>
      {(section === "listening" || section === "speaking") && (
        <div className="panel mb-6 p-4">
          <p className="mb-2 text-sm font-semibold">Output voice for review playback</p>
          <VoiceControls compact />
        </div>
      )}
      <div className="muted mb-6 text-sm">
        Comparable 0–120: {concordance?.overall120 ?? "—"} · Classic section scores use the older 0–30 scale.
        {bands.projectedOverall != null && (
          <>
            {" "}
            · Projected overall from source attempt: <Band value={bands.projectedOverall} />
            {concordance?.projected120 != null ? ` (≈ ${concordance.projected120})` : ""}
          </>
        )}
      </div>
      <p className="muted mb-8 text-xs leading-5">{concordance?.notes?.method}</p>

      <TimingSummary session={session} section={section} />

      <ReviewItems
        session={session}
        section={section}
        emailFeedback={traits?.traits?.email}
        discussionFeedback={traits?.traits?.discussion}
        speakingResults={traits?.itemResults}
      />
    </div>
    </AppShell>
  );
}

type SpeakingItemResult = {
  score?: number;
  wer?: number;
  how_to_improve?: string;
  traits?: { method?: string };
};

function ReviewItems({
  session,
  section,
  emailFeedback,
  discussionFeedback,
  speakingResults,
}: {
  session: ClientSession;
  section: SectionName;
  emailFeedback?: WritingReviewFeedback;
  discussionFeedback?: WritingReviewFeedback;
  speakingResults?: Record<string, SpeakingItemResult>;
}) {
  const form = session.form;
  const timing = parseTiming(session.timing);
  const mcq: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(session.responses)) {
    mcq[k] = typeof v.value === "number" ? v.value : null;
  }
  const wordValues = (setIdTokens: Array<{ itemId?: string }>) => {
    const values: Record<string, string> = {};
    for (const t of setIdTokens) {
      if (t.itemId) values[t.itemId] = String(session.responses[t.itemId]?.value ?? "");
    }
    return values;
  };

  return (
    <div className="space-y-8">
      {section === "reading" &&
        (["m1", session.readingRoute || "lower"] as const).map((mod) => (
          <div key={`r-${mod}`}>
            <h2 className="mb-3 text-lg font-semibold">Reading {mod === "m1" ? "Module 1" : `Module 2 (${session.readingRoute || "lower"})`}</h2>
            {flattenReadingSets(readingBundle(form, mod === "m1" ? "m1" : (mod as "lower" | "upper")), session.scope).map((set) => (
              <div key={set.id} className="mb-5">
                <TimeChip ms={itemMs(timing, set.id)} />
                {set.taskType === "complete_the_words" && (
                  <CompleteTheWordsTask set={set} values={wordValues(set.tokens)} onChange={() => undefined} review />
                )}
                {set.taskType === "read_daily_life" && (
                  <DailyLifeTask set={set} values={mcq} onChange={() => undefined} review />
                )}
                {set.taskType === "read_academic" && (
                  <AcademicTask set={set} values={mcq} onChange={() => undefined} review />
                )}
              </div>
            ))}
          </div>
        ))}

      {section === "listening" &&
        (["m1", session.listeningRoute || "lower"] as const).map((mod) => (
          <div key={`l-${mod}`}>
            <h2 className="mb-3 text-lg font-semibold">Listening {mod === "m1" ? "Module 1" : `Module 2 (${session.listeningRoute || "lower"})`}</h2>
            {flattenListeningItems(listeningBundle(form, mod === "m1" ? "m1" : (mod as "lower" | "upper")), session.scope).map((entry) => (
              <div key={entry.kind === "choose" ? entry.item.id : entry.item.id} className="mb-5">
                <TimeChip ms={itemMs(timing, entry.item.id)} />
                {entry.kind === "choose" ? (
                  <ListenChooseTask item={entry.item} value={mcq[entry.item.id] ?? null} onChange={() => undefined} review />
                ) : (
                  <SpokenSetTask set={entry.item} values={mcq} onChange={() => undefined} review />
                )}
              </div>
            ))}
          </div>
        ))}

      {section === "writing" && (
        <>
          <h2 className="text-lg font-semibold">Writing</h2>
          {form.writing.sentences.map((item) => (
            <div key={item.id}>
              <TimeChip ms={itemMs(timing, item.id)} />
              <SentenceBuilder
                item={item}
                value={Array.isArray(session.responses[item.id]?.value) ? (session.responses[item.id].value as string[]) : []}
                onChange={() => undefined}
                review
              />
            </div>
          ))}
          <TimeChip ms={itemMs(timing, form.writing.email.id)} />
          <EmailTaskView
            task={form.writing.email}
            value={String(session.responses[form.writing.email.id]?.value ?? "")}
            onChange={() => undefined}
            review
            feedback={emailFeedback}
          />
          <TimeChip ms={itemMs(timing, form.writing.discussion.id)} />
          <DiscussionTaskView
            task={form.writing.discussion}
            value={String(session.responses[form.writing.discussion.id]?.value ?? "")}
            onChange={() => undefined}
            review
            feedback={discussionFeedback}
          />
        </>
      )}

      {section === "speaking" && (
        <>
          <h2 className="text-lg font-semibold">Speaking</h2>
          <p className="muted mb-4 text-sm leading-6">
            Listen and Repeat is scored 0–5 from how closely the transcript matches the target sentence
            (word-error rate). Interview answers are scored 0–5 from the transcript: an LLM rubric if an
            API key is configured, otherwise length and how completely the question is answered.
          </p>
          {form.speaking.listenRepeat.items.map((item, i) => (
            <div key={item.id}>
              <SpeakingScoreNote result={speakingResults?.[item.id]} kind="repeat" />
              <TimeChip ms={itemMs(timing, item.id)} />
              <RepeatTask
                item={item}
                index={i}
                total={form.speaking.listenRepeat.items.length}
                setting={form.speaking.listenRepeat.setting}
                onSave={() => undefined}
                review
                recordingPath={session.responses[item.id]?.recordingPath}
                transcript={session.responses[item.id]?.transcript}
              />
            </div>
          ))}
          {form.speaking.interview.items.map((item) => (
            <div key={item.id}>
              <SpeakingScoreNote result={speakingResults?.[item.id]} kind="interview" />
              <TimeChip ms={itemMs(timing, item.id)} />
              <InterviewTask
                item={item}
                interviewer={form.speaking.interview.interviewer}
                onSave={() => undefined}
                review
                recordingPath={session.responses[item.id]?.recordingPath}
                transcript={session.responses[item.id]?.transcript}
              />
            </div>
          ))}
        </>
      )}

      <div className="flex gap-2">
        <PrimaryButton onClick={() => (window.location.href = appPath("/"))}>Main page</PrimaryButton>
      </div>
    </div>
  );
}

function SpeakingScoreNote({
  result,
  kind,
}: {
  result?: SpeakingItemResult;
  kind: "repeat" | "interview";
}) {
  if (!result || result.score == null) return null;
  const extra =
    kind === "repeat" && result.wer != null
      ? ` · Word-error rate ${Math.round(result.wer * 100)}%`
      : kind === "interview"
        ? result.traits?.method === "heuristic-or-transcript"
          ? " · Length and completeness check"
          : " · LLM rubric"
        : "";
  return (
    <p className="mb-2 text-sm font-semibold text-[#be123c]">
      Score: {result.score}/5{extra}
    </p>
  );
}

function TimeChip({ ms }: { ms?: number }) {
  if (!ms) return null;
  return <p className="mb-2 text-xs font-semibold text-[#0f766e]">Time on this question: {formatSpent(ms)}</p>;
}

function TimingSummary({ session, section }: { session: ClientSession; section: SectionName }) {
  const timing = parseTiming(session.timing);
  const allRows: Array<{ section: SectionName; label: string; keys: string[]; limit?: number | null }> = [
    { section: "reading", label: "Reading Module 1", keys: ["reading:m1"], limit: officialLimit("reading:m1") },
    { section: "reading", label: "Reading Module 2", keys: ["reading:m2"], limit: officialLimit("reading:m2") },
    { section: "listening", label: "Listening Module 1", keys: ["listening:m1"], limit: officialLimit("listening:m1") },
    {
      section: "listening",
      label: "Listening Module 2",
      keys: ["listening:m2"],
      limit: officialLimit("listening:m2", session.listeningRoute),
    },
    { section: "writing", label: "Build a Sentence", keys: ["writing:sentences"], limit: officialLimit("writing:sentences") },
    { section: "writing", label: "Email", keys: ["writing:email"], limit: officialLimit("writing:email") },
    { section: "writing", label: "Discussion", keys: ["writing:discussion"], limit: officialLimit("writing:discussion") },
    { section: "speaking", label: "Listen and Repeat", keys: ["speaking:repeat"] },
    { section: "speaking", label: "Interview", keys: ["speaking:interview"] },
  ];
  const rows = allRows.filter((row) => row.section === section);
  const reading = partMs(timing, ["reading:m1", "reading:m2"]);
  const listening = partMs(timing, ["listening:m1", "listening:m2"]);
  const writing = partMs(timing, ["writing:sentences", "writing:email", "writing:discussion"]);
  const speaking = partMs(timing, ["speaking:repeat", "speaking:interview"]);
  const sectionMs = { reading, listening, writing, speaking }[section];
  if (!sectionMs) {
    return (
      <div className="muted panel mb-8 p-4 text-sm">
        Time on each part will appear for attempts started after this update.
      </div>
    );
  }
  return (
    <div className="panel mb-8 p-5">
      <h2 className="mb-3 text-lg font-semibold">Time spent · {section}</h2>
      <div className="mb-4">
        <div className="muted text-xs uppercase">{section}</div>
        <div className="font-semibold">{formatSpent(sectionMs)}</div>
      </div>
      <div className="space-y-1 text-sm">
        {rows.map((row) => {
          const ms = partMs(timing, row.keys);
          if (!ms) return null;
          return (
            <div key={row.label} className="flex justify-between gap-3">
              <span>{row.label}</span>
              <span className="font-medium">
                {formatSpent(ms)}
                {row.limit ? ` / ${formatSpent(row.limit)} official` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
