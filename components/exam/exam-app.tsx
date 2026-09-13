"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flattenListeningItems, flattenReadingSets, listeningBundle, pointerTitle, readingBundle, readingItemIds, speakingInterviewItems, speakingRepeatItems } from "@/lib/form";
import { parseScope } from "@/lib/scope";
import { formatClock } from "@/lib/timing";
import { addTime, emptyTiming, parseTiming, partKey, type SessionTiming } from "@/lib/timing-log";
import type { ClientSession } from "@/lib/client-types";
import type { AcademicSet, CompleteTheWordsSet, DailyLifeSet, Pointer } from "@/lib/types";
import { PlayOnceAudio } from "../audio-play";
import { VolumeSlider } from "../voice/voice-context";
import { GhostButton, PrimaryButton } from "../ui";
import { AcademicTask, CompleteTheWordsTask, DailyLifeTask } from "../tasks/reading";
import { ListenChooseTask, SpokenSetTask } from "../tasks/listening";
import { DiscussionTaskView, EmailTaskView, SentenceBuilder } from "../tasks/writing";
import { InterviewTask, MicMeter, RepeatTask } from "../tasks/speaking";

async function loadSession(id: string): Promise<ClientSession> {
  const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load session");
  return res.json();
}

export function ExamApp({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ready, setReady] = useState(true);
  const [reviewJump, setReviewJump] = useState<number | null>(null);
  const [hideClock, setHideClock] = useState(false);
  const timingRef = useRef<SessionTiming>(emptyTiming());
  const sliceRef = useRef({ part: null as string | null, item: null as string | null, at: Date.now(), ready: false });

  useEffect(() => {
    loadSession(sessionId)
      .then((s) => {
        if (s.status === "completed" || s.currentPointer === "completed") {
          router.replace(`/review/${sessionId}`);
          return;
        }
        timingRef.current = parseTiming(s.timing);
        setSession(s);
      })
      .catch((e) => setError(e.message));
  }, [sessionId]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const remaining = session?.sectionEndsAt ? new Date(session.sectionEndsAt).getTime() - now : null;
  const timedOut = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (timedOut && session && !busy) {
      void goNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  function persistTiming(next: SessionTiming) {
    timingRef.current = next;
    setSession((prev) => (prev ? { ...prev, timing: next } : prev));
    void fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timing: next }),
    });
  }

  function flushTiming() {
    const prev = sliceRef.current;
    if (!prev.ready) return;
    const ms = Date.now() - prev.at;
    const next = addTime(timingRef.current, prev.part, prev.item, ms);
    if (next !== timingRef.current) persistTiming(next);
    prev.at = Date.now();
  }

  useEffect(() => {
    if (!session) return;
    if (sliceRef.current.ready) flushTiming();
    sliceRef.current = {
      part: partKey(session.currentPointer as Pointer),
      item: currentViewId(session, session.currentPointer as Pointer, index),
      at: Date.now(),
      ready: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.currentPointer, index]);

  useEffect(() => {
    const onHide = () => flushTiming();
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      flushTiming();
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(itemId: string, value: unknown, transcript?: string) {
    setSession((prev) =>
      prev
        ? {
            ...prev,
            responses: {
              ...prev.responses,
              [itemId]: { ...prev.responses[itemId], value, transcript },
            },
          }
        : prev,
    );
    await fetch(`/api/sessions/${sessionId}/responses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, value, transcript }),
    });
  }

  async function uploadRecording(itemId: string, blob: Blob) {
    const data = new FormData();
    data.set("itemId", itemId);
    data.set("file", blob, `${itemId}.webm`);
    await fetch(`/api/sessions/${sessionId}/record`, { method: "POST", body: data });
    setSession((prev) =>
      prev
        ? {
            ...prev,
            responses: { ...prev.responses, [itemId]: { ...prev.responses[itemId], value: { recorded: true } } },
          }
        : prev,
    );
  }

  async function goNext() {
    if (!session || busy) return;
    flushTiming();
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/advance`, { method: "POST" });
    const next = (await res.json()) as ClientSession & { error?: string };
    setBusy(false);
    if (res.status === 409 || next.currentPointer === "completed" || next.status === "completed") {
      router.replace(`/review/${sessionId}`);
      return;
    }
    setIndex(0);
    setReviewJump(null);
    setSession({ ...next, timing: timingRef.current });
  }

  if (error) return <div className="p-8">{error}</div>;
  if (!session) return <div className="p-8">Loading exam…</div>;

  const pointer = session.currentPointer as Pointer;
  const scope = parseScope(JSON.stringify(session.scope));
  const form = session.form;

  const viewingReviewItem = pointer.startsWith("reading:review") && reviewJump !== null;
  const label = nextLabel(pointer, viewingReviewItem ? reviewJump : index, form, session);

  async function onNext() {
    if (pointer.startsWith("reading:review") && reviewJump !== null) {
      setReviewJump(null);
      return;
    }
    if (label === "Submit module") {
      const ok = window.confirm("You cannot return to this module after you submit. Submit now?");
      if (!ok) return;
    }
    if (label === "Finish") {
      const ok = window.confirm("Submit the speaking section and finish the test?");
      if (!ok) return;
    }
    if (!session) return;
    await goNextOrAdvance(pointer, index, setIndex, form, session, goNext);
  }

  return (
    <div className="exam-chrome">
      <header className="exam-header">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-200">{sectionName(pointer)}</div>
          <div className="font-semibold">{pointerTitle(pointer)}</div>
          <div className="text-xs text-slate-200">{progressLabel(session, pointer, viewingReviewItem ? reviewJump : index)}</div>
        </div>
        <div className="relative flex items-center gap-4">
          <button type="button" className="text-sm underline" onClick={() => setHelpOpen((v) => !v)}>
            Help
          </button>
          <button type="button" className="text-sm underline" onClick={() => setVolumeOpen((v) => !v)}>
            Volume
          </button>
          <button type="button" className="text-sm underline" onClick={() => setNotesOpen((v) => !v)}>
            Notes
          </button>
          {remaining !== null && (
            <>
              <button type="button" className="text-sm underline" onClick={() => setHideClock((v) => !v)}>
                {hideClock ? "Show Time" : "Hide Time"}
              </button>
              {!hideClock && <div className="clock text-xl">{formatClock(remaining)}</div>}
            </>
          )}
          {volumeOpen && (
            <div className="panel absolute right-0 top-12 z-20 w-72 max-w-[90vw] p-3 text-[#1b2430]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6775]">Volume</p>
              <VolumeSlider />
            </div>
          )}
          {helpOpen && (
            <div className="panel absolute right-0 top-12 z-20 w-[28rem] max-w-[90vw] p-3 text-sm leading-6 text-[#1b2430]">
              {helpText(pointer)}
            </div>
          )}
        </div>
      </header>
      <main className="exam-main">
        <Stage
          session={session}
          pointer={pointer}
          index={index}
          reviewJump={reviewJump}
          setIndex={setIndex}
          setReviewJump={setReviewJump}
          persist={persist}
          uploadRecording={uploadRecording}
          onCheckin={goNext}
          onGate={setReady}
        />
        {notesOpen && (
          <aside className="panel fixed right-4 top-20 z-10 w-80 p-3">
            <textarea
              value={session.notepad}
              onChange={(e) => {
                const notepad = e.target.value;
                setSession({ ...session, notepad });
                void fetch(`/api/sessions/${sessionId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ notepad }),
                });
              }}
              className="h-48 w-full border p-2 text-sm"
              placeholder="Scratch notes"
            />
          </aside>
        )}
      </main>
      <footer className="exam-footer">
        <GhostButton
          disabled={
            viewingReviewItem
              ? false
              : index <= 0 || !canBack(pointer)
          }
          onClick={() => {
            if (viewingReviewItem) {
              setReviewJump(null);
              return;
            }
            setIndex((i) => Math.max(0, i - 1));
          }}
        >
          Back
        </GhostButton>
        <div className="text-sm text-slate-200">{progressLabel(session, pointer, viewingReviewItem ? reviewJump : index)}</div>
        <PrimaryButton
          disabled={busy || (!ready && needsAudioGate(pointer) && !viewingReviewItem)}
          onClick={() => void onNext()}
        >
          {viewingReviewItem ? "Return to review" : label}
        </PrimaryButton>
      </footer>
    </div>
  );
}

function needsAudioGate(pointer: Pointer) {
  return pointer === "listening:m1" || pointer === "listening:m2" || pointer === "speaking:repeat" || pointer === "speaking:interview";
}

function sectionName(pointer: Pointer) {
  if (pointer.startsWith("reading") || pointer === "directions:reading") return "Reading";
  if (pointer.startsWith("listening") || pointer === "directions:listening") return "Listening";
  if (pointer.startsWith("writing") || pointer === "directions:writing") return "Writing";
  if (pointer.startsWith("speaking") || pointer === "directions:speaking") return "Speaking";
  return "TOEFL iBT";
}

function helpText(pointer: Pointer) {
  if (pointer.startsWith("reading")) {
    return "You may go back to questions in this module. After you submit the module, you cannot return. Select one answer for each multiple-choice question. For Complete the Words, type the missing letters.";
  }
  if (pointer.startsWith("listening")) {
    return "Each recording plays once. Questions appear after the audio finishes. You cannot go back to a previous listening item.";
  }
  if (pointer.startsWith("writing")) {
    return "Build a Sentence: put the words in order. Email: 7 minutes. Discussion: 10 minutes. Spelling tools are off.";
  }
  if (pointer.startsWith("speaking")) {
    return "Listen and Repeat: hear the sentence once, then repeat it. Interview: 45 seconds after the question. Each response is recorded once.";
  }
  return "Follow the directions on the screen. The section clock starts when you continue from directions.";
}

function progressLabel(session: ClientSession, pointer: Pointer, index: number) {
  if (pointer === "reading:m1" || pointer === "reading:m2") {
    const n = readingSets(session, pointer === "reading:m1" ? "m1" : "m2").length;
    return n ? `Question ${index + 1} of ${n}` : "";
  }
  if (pointer === "listening:m1" || pointer === "listening:m2") {
    const n = listeningEntries(session, pointer === "listening:m1" ? "m1" : "m2").length;
    return n ? `Question ${index + 1} of ${n}` : "";
  }
  if (pointer === "writing:sentences") {
    return `Question ${index + 1} of ${session.form.writing.sentences.length}`;
  }
  if (pointer === "writing:email") return "Question 11 of 12";
  if (pointer === "writing:discussion") return "Question 12 of 12";
  if (pointer === "speaking:repeat") {
    const n = speakingRepeatItems(session.form, session.scope).length;
    return `Question ${index + 1} of ${n + speakingInterviewItems(session.form, session.scope).length}`;
  }
  if (pointer === "speaking:interview") {
    const repeats = speakingRepeatItems(session.form, session.scope).length;
    const n = speakingInterviewItems(session.form, session.scope).length;
    return `Question ${repeats + index + 1} of ${repeats + n}`;
  }
  return "";
}

function canBack(pointer: Pointer) {
  return (
    pointer === "reading:m1" ||
    pointer === "reading:m2" ||
    pointer === "reading:review-m1" ||
    pointer === "reading:review-m2" ||
    pointer === "writing:sentences"
  );
}

function readingSets(session: ClientSession, module: "m1" | "m2") {
  const route = module === "m1" ? "m1" : ((session.readingRoute as "lower" | "upper") || "lower");
  return flattenReadingSets(readingBundle(session.form, route), session.scope);
}

function currentViewId(session: ClientSession, pointer: Pointer, index: number): string | null {
  if (pointer === "reading:m1" || pointer === "reading:m2") {
    return readingSets(session, pointer === "reading:m1" ? "m1" : "m2")[index]?.id ?? null;
  }
  if (pointer === "listening:m1" || pointer === "listening:m2") {
    return listeningEntries(session, pointer === "listening:m1" ? "m1" : "m2")[index]?.item.id ?? null;
  }
  if (pointer === "writing:sentences") return session.form.writing.sentences[index]?.id ?? null;
  if (pointer === "writing:email") return session.form.writing.email.id;
  if (pointer === "writing:discussion") return session.form.writing.discussion.id;
  if (pointer === "speaking:repeat") return speakingRepeatItems(session.form, session.scope)[index]?.id ?? null;
  if (pointer === "speaking:interview") return speakingInterviewItems(session.form, session.scope)[index]?.id ?? null;
  return null;
}

function listeningEntries(session: ClientSession, module: "m1" | "m2") {
  const route = module === "m1" ? "m1" : ((session.listeningRoute as "lower" | "upper") || "lower");
  return flattenListeningItems(listeningBundle(session.form, route), session.scope);
}

function nextLabel(pointer: Pointer, index: number, form: ClientSession["form"], session: ClientSession) {
  if (pointer === "reading:m1" || pointer === "reading:m2") {
    const sets = readingSets(session, pointer === "reading:m1" ? "m1" : "m2");
    return index < sets.length - 1 ? "Next" : "Review";
  }
  if (pointer === "listening:m1" || pointer === "listening:m2") {
    const items = listeningEntries(session, pointer === "listening:m1" ? "m1" : "m2");
    return index < items.length - 1 ? "Next" : "Continue";
  }
  if (pointer === "writing:sentences") {
    return index < form.writing.sentences.length - 1 ? "Next" : "Continue";
  }
  if (pointer === "speaking:repeat") {
    return index < speakingRepeatItems(form, session.scope).length - 1 ? "Next" : "Continue";
  }
  if (pointer === "speaking:interview") {
    return index < speakingInterviewItems(form, session.scope).length - 1 ? "Next" : "Finish";
  }
  if (pointer === "reading:review-m1" || pointer === "reading:review-m2") return "Submit module";
  return "Continue";
}

async function goNextOrAdvance(
  pointer: Pointer,
  index: number,
  setIndex: (fn: (i: number) => number) => void,
  form: ClientSession["form"],
  session: ClientSession,
  goNext: () => Promise<void>,
) {
  const limits: Partial<Record<Pointer, number>> = {
    "reading:m1": readingSets(session, "m1").length,
    "reading:m2": readingSets(session, "m2").length,
    "listening:m1": listeningEntries(session, "m1").length,
    "listening:m2": listeningEntries(session, "m2").length,
    "writing:sentences": form.writing.sentences.length,
    "speaking:repeat": speakingRepeatItems(form, session.scope).length,
    "speaking:interview": speakingInterviewItems(form, session.scope).length,
  };
  const max = limits[pointer];
  if (max && index < max - 1) {
    setIndex((i) => i + 1);
    return;
  }
  await goNext();
}

function Stage({
  session,
  pointer,
  index,
  reviewJump,
  setIndex,
  setReviewJump,
  persist,
  uploadRecording,
  onCheckin,
  onGate,
}: {
  session: ClientSession;
  pointer: Pointer;
  index: number;
  reviewJump: number | null;
  setIndex: (n: number) => void;
  setReviewJump: (n: number | null) => void;
  persist: (itemId: string, value: unknown, transcript?: string) => Promise<void>;
  uploadRecording: (itemId: string, blob: Blob) => Promise<void>;
  onCheckin: () => void;
  onGate: (ready: boolean) => void;
}) {
  const form = session.form;
  const mcqValues = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(session.responses)) {
      out[k] = typeof v.value === "number" ? v.value : null;
    }
    return out;
  }, [session.responses]);

  useEffect(() => {
    onGate(!needsAudioGate(pointer));
  }, [pointer, index, onGate]);

  if (pointer === "checkin") {
    return (
      <div className="panel mx-auto max-w-2xl p-8">
        <h1 className="mb-3 text-2xl font-semibold">Begin the test</h1>
        <p className="mb-4 leading-6">
          You will take Reading, then Listening, then Writing, then Speaking. There is no scheduled break.
          Listening audio plays once. Directions are untimed. The clock starts when you leave each directions screen.
        </p>
        <p className="mb-4 text-sm text-[#5b6775]">
          Use headphones if you can. You may use the on-screen notes. Browser spelling tools are off. You cannot change answers after you finish the test.
        </p>
        <div className="mb-6">
          <VolumeSlider />
        </div>
        <PrimaryButton onClick={onCheckin}>Continue</PrimaryButton>
      </div>
    );
  }

  if (pointer === "directions:reading") {
    return (
      <Directions
        title="Reading"
        body="You will complete Module 1, then an easier or harder Module 2 based on your performance. You may return to questions inside a module. You cannot go back after you submit a module."
      />
    );
  }
  if (pointer === "directions:listening") {
    return (
      <Directions
        title="Listening"
        body="You will hear campus and academic English once. Some questions are not printed until the audio finishes. Accents may be from the United States, the United Kingdom, or Australia."
      />
    );
  }
  if (pointer === "directions:writing") {
    return (
      <Directions
        title="Writing"
        body="Build a Sentence has about 6 minutes. The email has 7 minutes. The academic discussion has 10 minutes. Browser spelling tools are disabled."
      />
    );
  }
  if (pointer === "directions:speaking") {
    return (
      <Directions
        title="Speaking"
        body="You will repeat seven sentences, then answer four interview questions. Speak clearly into the microphone. Each response is recorded once."
      />
    );
  }
  if (pointer === "speaking:check") {
    return (
      <div className="panel mx-auto max-w-xl p-8">
        <h1 className="mb-3 text-2xl font-semibold">Microphone check</h1>
        <p className="mb-4 text-sm">Speak normally and confirm the meter moves.</p>
        <MicMeter active />
      </div>
    );
  }
  if (pointer === "scoring") {
    return <div className="p-8">Scoring your responses…</div>;
  }

  if (pointer === "reading:m1" || pointer === "reading:m2" || pointer.startsWith("reading:review")) {
    const moduleKey = pointer.includes("m2") ? "m2" : "m1";
    const sets = readingSets(session, moduleKey);
    const viewIndex = pointer.startsWith("reading:review") && reviewJump !== null ? reviewJump : index;
    const set = sets[Math.min(viewIndex, Math.max(0, sets.length - 1))];
    if (pointer.startsWith("reading:review") && reviewJump === null) {
      return (
        <div className="panel mx-auto max-w-2xl p-6">
          <h2 className="mb-3 text-lg font-semibold">Review this module</h2>
          <p className="mb-4 text-sm">Open a question to change an answer. Then submit the module. You cannot return after you submit.</p>
          <div className="space-y-2">
            {sets.map((s, i) => {
              const ids = readingItemIds(s);
              const answered = ids.some((id) => session.responses[id]?.value != null && session.responses[id]?.value !== "");
              return (
                <button
                  key={s.id}
                  type="button"
                  className="option"
                  onClick={() => setReviewJump(i)}
                >
                  {i + 1}. {s.taskType.replaceAll("_", " ")} · {answered ? "Answered" : "Not answered"}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (!set) return <p>No items in this part.</p>;
    if (set.taskType === "complete_the_words") {
      const values: Record<string, string> = {};
      for (const t of (set as CompleteTheWordsSet).tokens) {
        if (t.itemId) values[t.itemId] = String(session.responses[t.itemId]?.value ?? "");
      }
      return (
        <CompleteTheWordsTask
          set={set as CompleteTheWordsSet}
          values={values}
          onChange={(id, value) => void persist(id, value)}
        />
      );
    }
    if (set.taskType === "read_daily_life") {
      return (
        <DailyLifeTask
          set={set as DailyLifeSet}
          values={mcqValues}
          onChange={(id, value) => void persist(id, value)}
        />
      );
    }
    return (
      <AcademicTask
        set={set as AcademicSet}
        values={mcqValues}
        onChange={(id, value) => void persist(id, value)}
      />
    );
  }

  if (pointer === "listening:m1" || pointer === "listening:m2") {
    const items = listeningEntries(session, pointer === "listening:m1" ? "m1" : "m2");
    const entry = items[index];
    if (!entry) return <p>No listening items.</p>;
    if (entry.kind === "choose") {
      return (
        <ListenChooseTask
          key={entry.item.id}
          item={entry.item}
          value={mcqValues[entry.item.id] ?? null}
          onChange={(id, value) => void persist(id, value)}
          onHeard={() => onGate(true)}
        />
      );
    }
    return (
      <SpokenSetTask
        key={entry.item.id}
        set={entry.item}
        values={mcqValues}
        onChange={(id, value) => void persist(id, value)}
        onHeard={() => onGate(true)}
      />
    );
  }

  if (pointer === "writing:sentences") {
    const item = form.writing.sentences[index];
    if (!item) return <p>No sentence items.</p>;
    const value = Array.isArray(session.responses[item.id]?.value)
      ? (session.responses[item.id].value as string[])
      : [];
    return <SentenceBuilder key={item.id} item={item} value={value} onChange={(next) => void persist(item.id, next)} />;
  }
  if (pointer === "writing:email") {
    const task = form.writing.email;
    return (
      <EmailTaskView
        task={task}
        value={String(session.responses[task.id]?.value ?? "")}
        onChange={(text) => void persist(task.id, text)}
      />
    );
  }
  if (pointer === "writing:discussion") {
    const task = form.writing.discussion;
    return (
      <DiscussionTaskView
        task={task}
        value={String(session.responses[task.id]?.value ?? "")}
        onChange={(text) => void persist(task.id, text)}
      />
    );
  }
  if (pointer === "speaking:repeat") {
    const items = speakingRepeatItems(form, session.scope);
    const item = items[index];
    if (!item) return <p>No repeat items.</p>;
    return (
      <RepeatTask
        key={item.id}
        item={item}
        index={index}
        total={items.length}
        setting={form.speaking.listenRepeat.setting}
        onSave={(blob) => void uploadRecording(item.id, blob)}
        onReady={() => onGate(true)}
      />
    );
  }
  if (pointer === "speaking:interview") {
    const items = speakingInterviewItems(form, session.scope);
    const item = items[index];
    if (!item) return <p>No interview items.</p>;
    return (
      <InterviewTask
        key={item.id}
        item={item}
        interviewer={form.speaking.interview.interviewer}
        onSave={(blob) => void uploadRecording(item.id, blob)}
        onReady={() => onGate(true)}
      />
    );
  }

  return (
    <div className="panel p-6">
      <PlayOnceAudio
        itemKey="speaking-scenario"
        audio={{ script: form.speaking.listenRepeat.scenario, accent: "us", gender: "female", fallbackTts: true }}
        hideScript={false}
        allowReplay
      />
    </div>
  );
}

function Directions({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel mx-auto max-w-2xl p-8">
      <h1 className="mb-3 text-2xl font-semibold">{title} directions</h1>
      <p className="leading-7">{body}</p>
      <p className="mt-4 text-sm text-[#5b6775]">The section clock starts when you continue.</p>
    </div>
  );
}
