"use client";

import { useMemo } from "react";
import type { BuildSentenceItem, DiscussionTask, EmailTask } from "@/lib/types";
import {
  analyzeDiscussionFormat,
  analyzeEmailFormat,
  sampleDiscussionAnswer,
  chooseEmailSample,
} from "@/lib/writing-feedback";

export type WritingReviewFeedback = {
  score?: number;
  how_to_improve?: string;
  reason?: string;
  formatIssues?: string[];
  sampleAnswer?: string;
};

export function SentenceBuilder({
  item,
  value,
  onChange,
  review,
}: {
  item: BuildSentenceItem;
  value: string[];
  onChange: (next: string[]) => void;
  review?: boolean;
}) {
  const chips = useMemo(() => {
    const tokens = item.tokens;
    const alreadyShuffled = tokens.join("\0") !== item.answer.join("\0");
    return alreadyShuffled ? tokens : seededShuffle(tokens, item.id);
  }, [item.id, item.tokens, item.answer]);
  const used = new Map<string, number>();
  for (const token of value) used.set(token, (used.get(token) || 0) + 1);
  const available = chips.filter((token) => {
    const count = chips.filter((t) => t === token).length;
    return (used.get(token) || 0) < count;
  });

  return (
    <div className="panel mx-auto w-full max-w-5xl p-6">
      <h2 className="mb-2 text-lg font-semibold">Build a Sentence</h2>
      <pre className="mb-4 whitespace-pre-wrap font-sans text-sm leading-6">{item.exchange}</pre>
      <div className="mb-4 min-h-28 rounded border border-dashed border-[#1f4e79] p-4">
        {value.length === 0 && <span className="text-sm text-[#5b6775]">Click words to build the sentence.</span>}
        <div className="flex flex-wrap gap-2">
          {value.map((token, i) => (
            <button
              key={`${token}-${i}`}
              type="button"
              disabled={review}
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="max-w-full rounded bg-[#e8f1fb] px-3 py-2 text-sm whitespace-normal break-words"
            >
              {token}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-24 rounded border border-[#c5d0da] bg-[#f8fafc] p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5b6775]">
          {review ? "Unused words" : "Word bank"}
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-[#5b6775]">{review ? "Every word was used." : "All words are in the sentence."}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map((token, i) => (
              <button
                key={`${token}-av-${i}`}
                type="button"
                disabled={review}
                onClick={() => onChange([...value, token])}
                className="max-w-full rounded border border-[#c5d0da] bg-white px-3 py-2 text-sm whitespace-normal break-words"
              >
                {token}
              </button>
            ))}
          </div>
        )}
      </div>
      {review && (
        <div className="mt-4 space-y-3 text-sm">
          {value.join(" ") !== item.answer.join(" ") && (
            <div className="rounded border-2 border-red-700 bg-red-50 p-3 text-red-950">
              <div className="mb-1 text-xs font-bold uppercase">Your sentence</div>
              {value.length ? value.join(" ") : "(empty)"}
            </div>
          )}
          <div className="rounded border-2 border-green-700 bg-green-50 p-3 text-green-950">
            <div className="mb-1 text-xs font-bold uppercase">Correct sentence</div>
            {item.answer.join(" ")}
          </div>
          <p className="text-[#5b6775]">{item.rationale}</p>
        </div>
      )}
    </div>
  );
}

export function EmailTaskView({
  task,
  value,
  onChange,
  review,
  feedback,
}: {
  task: EmailTask;
  value: string;
  onChange: (text: string) => void;
  review?: boolean;
  feedback?: WritingReviewFeedback;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const formatIssues = feedback?.formatIssues ?? (review ? analyzeEmailFormat(value) : []);
  const sample = chooseEmailSample(task, feedback?.sampleAnswer);
  return (
    <div className="panel mx-auto w-full max-w-5xl p-6">
      <h2 className="mb-2 text-lg font-semibold">Write an Email</h2>
      <p className="mb-2 text-sm text-[#5b6775]">To: {task.audience}</p>
      <p className="mb-4 leading-6">{task.scenario}</p>
      <textarea
        value={value}
        disabled={review}
        spellCheck={false}
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        className="box-border h-64 min-h-64 w-full min-w-0 resize-none border border-[#c5d0da] p-3 text-base leading-7 outline-none"
      />
      <div className="mt-2 text-sm text-[#5b6775]">{words} words · Goal: {task.goal}</div>
      {review && (
        <WritingReviewPanel
          title="Email"
          score={feedback?.score}
          max={5}
          reason={feedback?.reason || feedback?.how_to_improve}
          formatIssues={formatIssues}
          sample={sample}
        />
      )}
    </div>
  );
}

export function DiscussionTaskView({
  task,
  value,
  onChange,
  review,
  feedback,
}: {
  task: DiscussionTask;
  value: string;
  onChange: (text: string) => void;
  review?: boolean;
  feedback?: WritingReviewFeedback;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const formatIssues = feedback?.formatIssues ?? (review ? analyzeDiscussionFormat(value, task.prompt) : []);
  const sample = feedback?.sampleAnswer || sampleDiscussionAnswer(task);
  return (
    <div className="split-panes mx-auto max-w-5xl">
      <div className="split-pane panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{task.course}</h2>
        <p className="mb-3 text-sm font-semibold">{task.professor.name}</p>
        <p className="mb-4 text-sm leading-6">{task.professor.text}</p>
        {task.students.map((s) => (
          <div key={s.name} className="mb-3 border-t border-[#e4e9ee] pt-3">
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-sm leading-6">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="split-pane panel p-5">
        <p className="mb-3 text-sm">{task.prompt}</p>
        <textarea
          value={value}
          disabled={review}
          spellCheck={false}
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          className="box-border h-72 min-h-56 w-full min-w-0 resize-none border border-[#c5d0da] p-3 text-base leading-7 outline-none"
        />
        <div className="mt-2 text-sm text-[#5b6775]">{words} words</div>
        {review && (
          <WritingReviewPanel
            title="Discussion"
            score={feedback?.score}
            max={5}
            reason={feedback?.reason || feedback?.how_to_improve}
            formatIssues={formatIssues}
            sample={sample}
          />
        )}
      </div>
    </div>
  );
}

function WritingReviewPanel({
  title,
  score,
  max,
  reason,
  formatIssues,
  sample,
}: {
  title: string;
  score?: number;
  max: number;
  reason?: string;
  formatIssues: string[];
  sample: string;
}) {
  return (
    <div className="mt-5 space-y-3 text-sm">
      {score != null && (
        <p className="font-semibold">
          {title} score: {score}/{max}
        </p>
      )}
      {reason && (
        <div className="rounded border border-[#1f4e79] bg-[#e8f1fb] p-3">
          <div className="mb-1 text-xs font-bold uppercase text-[#1f4e79]">Why this score</div>
          <p className="leading-6">{reason}</p>
        </div>
      )}
      <div
        className={`rounded border-2 p-3 ${
          formatIssues.length ? "border-red-700 bg-red-50 text-red-950" : "border-green-700 bg-green-50 text-green-950"
        }`}
      >
        <div className="mb-1 text-xs font-bold uppercase">Format check</div>
        {formatIssues.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {formatIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p>
            {title === "Email"
              ? "No format mistakes found (greeting, closing, length, and punctuation checks passed)."
              : "No format mistakes found (length, position, punctuation, and originality checks passed)."}
          </p>
        )}
      </div>
      <div className="rounded border border-[#c5d0da] bg-[#f8fafc] p-3">
        <div className="mb-1 text-xs font-bold uppercase text-[#5b6775]">Sample answer</div>
        <pre className="whitespace-pre-wrap font-sans leading-6">{sample}</pre>
      </div>
    </div>
  );
}

function seededShuffle(tokens: string[], seed: string) {
  const copy = [...tokens];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  for (let i = copy.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
