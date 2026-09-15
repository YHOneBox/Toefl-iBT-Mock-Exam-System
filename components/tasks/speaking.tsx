"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioRef, InterviewItem, RepeatItem } from "@/lib/types";
import { applyPlaybackGain } from "@/lib/playback-gain";
import { useShowAnswer } from "../exam/answer-reveal";
import { PlayOnceAudio, RecordingPlayer } from "../audio-play";
import { useVoice } from "../voice/voice-context";

function recorderMime() {
  const types = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

const MIC_CHECK_LINE = "Testing, one, two, three.";
const MIC_CHECK_SECONDS = 6;

export function MicCheck({ onReady }: { onReady?: () => void }) {
  const { prefs } = useVoice();
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(MIC_CHECK_SECONDS);
  const [playing, setPlaying] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readySent = useRef(false);

  useEffect(() => {
    let raf = 0;
    let ctx: AudioContext | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setMicReady(true);
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          setLevel(Math.min(100, data.reduce((sum, value) => sum + value, 0) / data.length));
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => setError("Allow the microphone, then record a sample."));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (timer.current) window.clearInterval(timer.current);
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      ctx?.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    };
  }, [sampleUrl]);

  function stopPlayback() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }

  function keepSample(blob: Blob) {
    setSampleUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    if (!readySent.current) {
      readySent.current = true;
      onReady?.();
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || recording) return;
    stopPlayback();
    const mime = recorderMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recRef.current = rec;
    chunks.current = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size > 0) keepSample(blob);
      setRecording(false);
    };
    rec.start();
    setRecording(true);
    setLeft(MIC_CHECK_SECONDS);
    const started = Date.now();
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const remain = MIC_CHECK_SECONDS - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remain));
      if (remain <= 0) stopRecording();
    }, 200);
  }

  function stopRecording() {
    if (timer.current) window.clearInterval(timer.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  }

  async function playSample() {
    if (!sampleUrl || recording) return;
    stopPlayback();
    const el = new Audio(sampleUrl);
    audioRef.current = el;
    applyPlaybackGain(el, prefs.volume);
    setPlaying(true);
    el.onended = () => setPlaying(false);
    el.onerror = () => {
      setPlaying(false);
      setError("Could not play that sample. Record again.");
    };
    await el.play().catch(() => {
      setPlaying(false);
      setError("Could not play that sample. Record again.");
    });
  }

  return (
    <div className="panel mx-auto max-w-xl p-8">
      <h1 className="mb-3 text-2xl font-semibold">Microphone check</h1>
      <p className="mb-4 text-sm leading-6">
        Say this sentence in a normal speaking voice, then play it back. Record again until it sounds clear
        enough.
      </p>
      <p className="mb-5 rounded-lg bg-[#eef4f2] px-4 py-3 text-lg font-semibold leading-7">
        “{MIC_CHECK_LINE}”
      </p>
      <div className="h-3 w-full max-w-xs overflow-hidden rounded bg-[#d5dbe3]">
        <div className="h-full bg-[#2b6cb0]" style={{ width: `${level}%` }} />
      </div>
      <p className="muted mt-2 text-sm">{recording ? `Recording… ${left}s` : "The meter should move when you speak."}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!micReady || recording}
          onClick={startRecording}
          className="rounded bg-[#9b2c2c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sampleUrl ? "Record again" : "Record"}
        </button>
        <button
          type="button"
          disabled={!recording}
          onClick={stopRecording}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Stop
        </button>
        <button
          type="button"
          disabled={!sampleUrl || recording || playing}
          onClick={() => void playSample()}
          className="rounded bg-[#1f4e79] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {playing ? "Playing…" : "Play sample"}
        </button>
      </div>
      {sampleUrl && (
        <p className="mt-4 text-sm text-[#0f766e]">
          Play the sample. If it is quiet or unclear, record again. Continue when it sounds good enough.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

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
    const mime = recorderMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
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

export function ScenarioIntro({
  title,
  setting,
  script,
  audio,
  onReady,
}: {
  title: string;
  setting: string;
  script: string;
  audio?: AudioRef;
  onReady?: () => void;
}) {
  const clip = audio || {
    script,
    accent: "us" as const,
    gender: "female" as const,
    fallbackTts: true,
    rate: 0.95,
  };
  return (
    <div className="panel mx-auto max-w-3xl p-6">
      <p className="mb-1 text-sm text-[#5b6775]">{title}</p>
      <h2 className="mb-3 text-lg font-semibold">{setting}</h2>
      <p className="mb-4 leading-6">{script}</p>
      <PlayOnceAudio
        itemKey={`intro:${title}:${script.slice(0, 40)}`}
        audio={clip}
        hideScript
        allowReplay
        label="Play intro"
        onEnded={() => onReady?.()}
      />
      <p className="mt-4 text-sm text-[#5b6775]">Play the prepared intro, then continue.</p>
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
  const showKey = useShowAnswer(review);
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
        hideScript={!showKey}
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
          {showKey && <p className="text-sm">Target: {item.sentence}</p>}
          <p className="text-sm text-[#5b6775]">Transcript: {transcript || "—"}</p>
          <RecordingPlayer path={recordingPath} />
        </div>
      )}
      {showKey && !review && (
        <div className="mt-4">
          <p className="text-sm">Target: {item.sentence}</p>
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
  const showKey = useShowAnswer(review);
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
        hideScript={!showKey}
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
