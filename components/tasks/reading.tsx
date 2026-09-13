"use client";

import { defaultInsertPositions, splitSentences } from "@/lib/passage";
import type { AcademicSet, CompleteTheWordsSet, DailyLifeSet, McqQuestion } from "@/lib/types";

function isInsertQuestion(q: McqQuestion) {
  return q.passageAction === "insert" || Boolean(q.insertSentence) || /insert/i.test(q.skill);
}

function isSelectQuestion(q: McqQuestion) {
  return q.passageAction === "select" || /select sentence/i.test(q.skill);
}

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
                size={letters}
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
  startAt = 1,
}: {
  questions: McqQuestion[];
  values: Record<string, number | null>;
  onChange: (id: string, value: number) => void;
  review?: boolean;
  startAt?: number;
}) {
  return (
    <div className="space-y-5">
      {questions.map((q, idx) => (
        <div key={q.id}>
          <p className="mb-2 font-medium">
            {startAt + idx}. {q.stem}
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
    <div className="split-panes">
      <div className="split-pane panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{set.title}</h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{set.text}</pre>
      </div>
      <div className="split-pane panel p-5">
        <McqList questions={set.questions} values={values} onChange={onChange} review={review} />
      </div>
    </div>
  );
}

function InsertSquare({
  label,
  selected,
  correct,
  wrong,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  correct?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-selected={selected}
      data-review-correct={correct || undefined}
      data-review-wrong={wrong || undefined}
      onClick={onClick}
      className="insert-square"
      aria-label={`Insert at square ${label}`}
    >
      {label}
    </button>
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
  const sentences = splitSentences(set.text);
  const insertQ = set.questions.find(isInsertQuestion);
  const selectQ = set.questions.find(isSelectQuestion);
  const positions = insertQ
    ? (insertQ.insertPositions?.length === 4 ? insertQ.insertPositions : defaultInsertPositions(sentences.length))
    : [];
  return (
    <div className="split-panes">
      <div className="split-pane panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{set.title}</h2>
        {insertQ?.insertSentence && (
          <div className="mb-4 rounded border border-[#c5d0da] bg-[#f8fafc] p-3 text-sm">
            <p className="mb-1 font-semibold">Sentence to insert</p>
            <p>{insertQ.insertSentence}</p>
          </div>
        )}
        <p className="text-sm leading-8">
          {sentences.map((sentence, index) => {
            const squareAt = positions.indexOf(index);
            const selectedSentence = selectQ ? values[selectQ.id] === index : false;
            const correctSentence = Boolean(review && selectQ && selectQ.answerKey === index);
            const wrongSentence = Boolean(review && selectQ && selectedSentence && selectQ.answerKey !== index);
            return (
              <span key={index}>
                {selectQ ? (
                  <button
                    type="button"
                    disabled={review}
                    data-selected={selectedSentence}
                    data-review-correct={correctSentence || undefined}
                    data-review-wrong={wrongSentence || undefined}
                    onClick={() => onChange(selectQ.id, index)}
                    className="passage-sent"
                  >
                    {sentence}
                  </button>
                ) : (
                  <span>{sentence}</span>
                )}{" "}
                {insertQ && squareAt >= 0 && (
                  <InsertSquare
                    label={String.fromCharCode(65 + squareAt)}
                    selected={values[insertQ.id] === squareAt}
                    correct={Boolean(review && insertQ.answerKey === squareAt)}
                    wrong={Boolean(review && values[insertQ.id] === squareAt && insertQ.answerKey !== squareAt)}
                    disabled={review}
                    onClick={() => onChange(insertQ.id, squareAt)}
                  />
                )}
              </span>
            );
          })}
        </p>
      </div>
      <div className="split-pane panel space-y-5 p-5">
        {set.questions.map((q, idx) => {
          if (isInsertQuestion(q)) {
            return (
              <div key={q.id}>
                <p className="mb-2 font-medium">
                  {idx + 1}. {q.stem}
                </p>
                <p className="text-sm text-[#5b6775]">
                  Click the black square in the passage where the sentence best fits.
                </p>
                {review && <p className="mt-2 text-sm text-[#5b6775]">{q.rationale}</p>}
              </div>
            );
          }
          if (isSelectQuestion(q)) {
            return (
              <div key={q.id}>
                <p className="mb-2 font-medium">
                  {idx + 1}. {q.stem}
                </p>
                <p className="text-sm text-[#5b6775]">Click the sentence in the passage.</p>
                {review && <p className="mt-2 text-sm text-[#5b6775]">{q.rationale}</p>}
              </div>
            );
          }
          return (
            <McqList
              key={q.id}
              questions={[q]}
              values={values}
              onChange={onChange}
              review={review}
              startAt={idx + 1}
            />
          );
        })}
      </div>
    </div>
  );
}
