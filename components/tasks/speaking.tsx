"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewItem, RepeatItem } from "@/lib/types";
import { PlayOnceAudio, RecordingPlayer } from "../audio-play";

export function MicMeter({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let ctx: AudioContext | undefined;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        stream = s;
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          setLevel(Math.min(100, data.reduce((a, b) => a + b, 0) / data.length));
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => undefined);
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
  }, [active]);
  return (
    <div className="h-3 w-64 overflow-hidden rounded bg-[#d5dbe3]">
      <div className="h-full bg-[#2b6cb0]" style={{ width: `${level}%` }} />
    </div>
  );
}

export function Recorder({
  seconds,
  onSave,
  disabled,
  autoStart = false,
}: {
  seconds: number;
  onSave: (blob: Blob, transcript: string) => void;
  disabled?: boolean;
  autoStart?: boolean;
}) {
  const [left, setLeft] = useState(seconds);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (autoStart && !started.current && !disabled) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, disabled]);

  async function start() {
    if (disabled || recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    recRef.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      onSave(blob, "");
    };
    rec.start();
    setRecording(true);
    setLeft(seconds);
    const started = Date.now();
    timer.current = window.setInterval(() => {
      const remain = seconds - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remain));
      if (remain <= 0) stop();
    }, 200);
  }

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  }

  const pct = ((seconds - left) / seconds) * 100;
  return (
    <div className="space-y-3">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{ background: `conic-gradient(#1f4e79 ${pct}%, #d5dbe3 0)` }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-semibold">
          {left}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || recording}
          onClick={start}
          className="rounded bg-[#9b2c2c] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Record
        </button>
        <button
          type="button"
          disabled={!recording}
          onClick={stop}
          className="rounded border px-3 py-2 text-sm"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export function RepeatTask({
  item,
  index,
  total,
  setting,
  onSave,
  review,
  recordingPath,
  transcript,
  onReady,
}: {
  item: RepeatItem;
  index: number;
  total: number;
  setting: string;
  onSave: (blob: Blob) => void;
  review?: boolean;
  recordingPath?: string | null;
  transcript?: string | null;
  onReady?: () => void;
}) {
  const [heard, setHeard] = useState(Boolean(review));

  useEffect(() => {
    if (review) onReady?.();
  }, [review, onReady]);

  return (
    <div className="panel mx-auto max-w-3xl p-6">
      <p className="mb-1 text-sm text-[#5b6775]">
        Listen and Repeat · {index + 1} of {total}
      </p>
      <h2 className="mb-3 text-lg font-semibold">{setting}</h2>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded ${i <= index ? "bg-[#1f4e79]" : "bg-[#d5dbe3]"}`}
          />
        ))}
      </div>
      <PlayOnceAudio
        itemKey={item.id}
        audio={item.audio}
        hideScript={!review}
        allowReplay={Boolean(review)}
        label="Play sentence"
        onEnded={() => setHeard(true)}
      />
      <p className="mt-4 text-sm text-[#5b6775]">
        {heard && !review
          ? "Recording. Repeat the sentence once."
          : `After the sentence plays, you will have ${item.seconds} seconds. Repeat only once.`}
      </p>
      {!review && heard && (
        <div className="mt-4">
          <Recorder
            seconds={item.seconds}
            autoStart
            onSave={(blob) => {
              onSave(blob);
              onReady?.();
            }}
          />
        </div>
      )}
      {review && (
        <div className="mt-4 space-y-2">
          <p className="text-sm">Target: {item.sentence}</p>
          <p className="text-sm text-[#5b6775]">Transcript: {transcript || "—"}</p>
          <RecordingPlayer path={recordingPath} />
        </div>
      )}
    </div>
  );
}

export function InterviewTask({
  item,
  interviewer,
  onSave,
  review,
  recordingPath,
  transcript,
  onReady,
}: {
  item: InterviewItem;
  interviewer: string;
  onSave: (blob: Blob) => void;
  review?: boolean;
  recordingPath?: string | null;
  transcript?: string | null;
  onReady?: () => void;
}) {
  const [heard, setHeard] = useState(Boolean(review));

  useEffect(() => {
    if (review) onReady?.();
  }, [review, onReady]);

  return (
    <div className="panel mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#d6e4f0] text-lg font-semibold">
          {interviewer.slice(0, 1)}
        </div>
        <div>
          <div className="font-semibold">{interviewer}</div>
          <div className="text-sm text-[#5b6775]">Interview question</div>
        </div>
      </div>
      <PlayOnceAudio
        itemKey={item.id}
        audio={item.audio}
        hideScript={!review}
        allowReplay={Boolean(review)}
        label="Play question"
        onEnded={() => setHeard(true)}
      />
      <p className="mt-4 leading-6">{item.prompt}</p>
      {!review && heard && (
        <div className="mt-5">
          <Recorder
            seconds={item.seconds}
            autoStart
            onSave={(blob) => {
              onSave(blob);
              onReady?.();
            }}
          />
        </div>
      )}
      {review && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-[#5b6775]">Transcript: {transcript || "—"}</p>
          <RecordingPlayer path={recordingPath} />
        </div>
      )}
    </div>
  );
}
