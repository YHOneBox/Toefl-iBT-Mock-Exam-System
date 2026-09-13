"use client";

import { useEffect, useState } from "react";
import type { ListenChooseItem, SpokenSet } from "@/lib/types";
import { DialoguePlayer, PlayOnceAudio } from "../audio-play";
import { McqList } from "./reading";

export function ListenChooseTask({
  item,
  value,
  onChange,
  review,
  onHeard,
}: {
  item: ListenChooseItem;
  value: number | null;
  onChange: (id: string, value: number) => void;
  review?: boolean;
  onHeard?: () => void;
}) {
  const [heard, setHeard] = useState(Boolean(review));

  useEffect(() => {
    if (review) onHeard?.();
  }, [review, onHeard]);

  function markHeard() {
    setHeard(true);
    onHeard?.();
  }

  return (
    <div className="panel mx-auto max-w-2xl p-6">
      <h2 className="mb-2 text-lg font-semibold">Listen and Choose a Response</h2>
      <p className="mb-4 text-sm text-[#5b6775]">
        You will hear a short question or statement. It is not printed. Choose the best response.
      </p>
      {review && (
        <p className="mb-2 text-xs capitalize text-[#5b6775]">
          Voice: {item.audio.gender} · {item.audio.accent.toUpperCase()}
        </p>
      )}
      <PlayOnceAudio
        itemKey={item.id}
        audio={item.audio}
        hideScript={!review}
        allowReplay={Boolean(review)}
        onEnded={markHeard}
      />
      {heard ? (
        <div className="mt-5">
          <McqList
            questions={[
              {
                id: item.id,
                skill: item.skill,
                cefr: item.cefr,
                stem: "Choose the best response.",
                options: item.options,
                answerKey: item.answerKey,
                rationale: item.rationale,
              },
            ]}
            values={{ [item.id]: value }}
            onChange={onChange}
            review={review}
          />
        </div>
      ) : (
        <p className="mt-5 text-sm text-[#5b6775]">The choices will appear after the audio finishes.</p>
      )}
    </div>
  );
}

export function SpokenSetTask({
  set,
  values,
  onChange,
  review,
  onHeard,
}: {
  set: SpokenSet;
  values: Record<string, number | null>;
  onChange: (id: string, value: number) => void;
  review?: boolean;
  onHeard?: () => void;
}) {
  const [heard, setHeard] = useState(Boolean(review));

  useEffect(() => {
    if (review) onHeard?.();
  }, [review, onHeard]);

  function markHeard() {
    setHeard(true);
    onHeard?.();
  }

  return (
    <div className="split-panes">
      <div className="split-pane panel p-5">
        <h2 className="mb-2 text-lg font-semibold">{review ? set.title : set.taskType === "listen_conversation" ? "Conversation" : set.taskType === "listen_announcement" ? "Announcement" : "Academic talk"}</h2>
        <div className="mb-4 flex gap-3">
          {set.speakers.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d6e4f0] font-semibold">
                {s.label.slice(0, 1)}
              </div>
              <div>
                <div>{s.label}</div>
                {review && (
                  <div className="text-xs capitalize text-[#5b6775]">
                    {s.gender} · {s.accent.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialoguePlayer set={set} allowReplay={Boolean(review)} onEnded={markHeard} />
        {review && (
          <pre className="mt-4 whitespace-pre-wrap text-sm text-[#5b6775]">
            {set.script.map((line) => `${line.speakerId}: ${line.text}`).join("\n")}
          </pre>
        )}
      </div>
      <div className="split-pane panel p-5">
        {heard ? (
          <McqList questions={set.questions} values={values} onChange={onChange} review={review} />
        ) : (
          <p className="text-sm leading-6 text-[#5b6775]">
            Listen to the audio once. Questions will appear when it finishes. You cannot replay it.
          </p>
        )}
      </div>
    </div>
  );
}
