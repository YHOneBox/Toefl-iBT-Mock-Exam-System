"use client";

import type { AcademicSet, CompleteTheWordsSet, DailyLifeSet, McqQuestion } from "@/lib/types";

export function CompleteTheWordsTask({
  set,
  values,
  onChange,
  review,
}: {
  set: CompleteTheWordsSet;
  values: Record<string, string>;
  onChange: (itemId: string, value: string) => void;
  review?: boolean;
}) {
  return (
    <div className="panel p-5">
      <h2 className="mb-3 text-lg font-semibold">Complete the Words</h2>
      <p className="mb-4 text-sm text-[#5b6775]">
        Fill in the missing letters. The first sentence is complete.
      </p>
      <p className="mb-4 leading-8">
        {set.firstSentence}{" "}
        {set.tokens.map((token, i) => {
          if (!token.isGap || !token.itemId) {
            return <span key={i}>{token.text}{token.punct || ""} </span>;
          }
          const typed = values[token.itemId] || "";
          const ok = review && typed.toLowerCase() === (token.answer || "").toLowerCase();
          const letters = Math.max(1, token.answer?.length || 4);
          return (
            <span key={token.itemId} className="ctw-word">
              <span>{token.prefix}</span>
              <input
                value={typed}
                maxLength={token.answer?.length || 12}
                disabled={review}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => onChange(token.itemId!, e.target.value)}
                style={{ ["--letters" as string]: String(letters) }}
                className={`outline-none ${review ? (ok ? "ctw-ok" : "ctw-bad") : ""}`}
                aria-label="missing letters"
              />
              <span>{token.punct || ""} </span>
              {review && !ok && (
                <span className="ml-1 rounded border-2 border-green-700 bg-green-100 px-1 text-xs font-semibold text-green-900">
                  {token.answer}
                </span>
              )}
            </span>
          );
        })}
      </p>
    </div>
  );
}

export function McqList({
  questions,
  values,
  onChange,
  review,
}: {
  questions: McqQuestion[];
  values: Record<string, number | null>;
  onChange: (id: string, value: number) => void;
  review?: boolean;
}) {
  return (
    <div className="space-y-5">
      {questions.map((q, idx) => (
        <div key={q.id}>
          <p className="mb-2 font-medium">
            {idx + 1}. {q.stem}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const selected = values[q.id] === i;
              const correct = Boolean(review && q.answerKey === i);
              const wrong = Boolean(review && selected && q.answerKey !== i);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={review}
                  data-selected={selected}
                  data-review-correct={correct || undefined}
                  data-review-wrong={wrong || undefined}
                  onClick={() => onChange(q.id, i)}
                  className="option"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {String.fromCharCode(65 + i)}. {opt}
                    </span>
                    {review && (
                      <span className="text-xs font-bold uppercase">
                        {wrong && "Your answer"}
                        {correct && (selected ? "Your answer · Correct" : "Correct answer")}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {review && <p className="mt-2 text-sm text-[#5b6775]">{q.rationale}</p>}
        </div>
      ))}
    </div>
  );
}

export function DailyLifeTask({
  set,
  values,
  onChange,
  review,
}: {
  set: DailyLifeSet;
  values: Record<string, number | null>;
  onChange: (id: string, value: number) => void;
  review?: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{set.title}</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{set.text}</pre>
      </div>
      <div className="panel p-5">
        <McqList questions={set.questions} values={values} onChange={onChange} review={review} />
      </div>
    </div>
  );
}

export function AcademicTask({
  set,
  values,
  onChange,
  review,
}: {
  set: AcademicSet;
  values: Record<string, number | null>;
  onChange: (id: string, value: number) => void;
  review?: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{set.title}</h2>
        <p className="text-sm leading-7">{set.text}</p>
      </div>
      <div className="panel p-5">
        <McqList questions={set.questions} values={values} onChange={onChange} review={review} />
      </div>
    </div>
  );
}
