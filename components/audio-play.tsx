"use client";

import { useEffect, useRef, useState } from "react";
import { langForAccent } from "@/lib/accents";
import type { AudioRef, SpokenSet } from "@/lib/types";
import { useVoice } from "./voice/voice-context";

export function PlayOnceAudio({
  itemKey,
  audio,
  label = "Play",
  allowReplay = false,
  hideScript = true,
  autoPlay = false,
  onEnded,
}: {
  itemKey: string;
  audio: AudioRef;
  label?: string;
  allowReplay?: boolean;
  hideScript?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
}) {
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { prefs, pickVoice } = useVoice();
  const ref = useRef<HTMLAudioElement | null>(null);
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    setPlayed(false);
    setPlaying(false);
    window.speechSynthesis.cancel();
    ref.current?.pause();
  }, [itemKey]);

  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(() => void play(), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, autoPlay]);

  function finish() {
    setPlaying(false);
    setPlayed(true);
    ended.current?.();
  }

  async function play() {
    if (played && !allowReplay) return;
    setPlaying(true);
    if (audio.path && !audio.fallbackTts) {
      const src = `/api/media?path=${encodeURIComponent(`data/audio/${audio.path}`)}`;
      const el = new Audio(src);
      ref.current = el;
      el.volume = prefs.volume;
      el.onended = finish;
      await el.play().catch(() => speak());
      return;
    }
    speak();
  }

  function speak() {
    const utter = new SpeechSynthesisUtterance(audio.script);
    utter.lang = langForAccent(audio.accent);
    utter.rate = prefs.rate;
    utter.volume = prefs.volume;
    const voice = pickVoice(audio.gender, audio.accent);
    if (voice) utter.voice = voice;
    utter.onend = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void play()}
        disabled={playing || (played && !allowReplay)}
        className="rounded bg-[#1f4e79] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {playing ? "Playing…" : played && !allowReplay ? "Played" : label}
      </button>
      {!hideScript && <p className="text-sm text-[#5b6775]">{audio.script}</p>}
    </div>
  );
}

export function DialoguePlayer({
  set,
  allowReplay = false,
  autoPlay = false,
  onEnded,
}: {
  set: SpokenSet;
  allowReplay?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
}) {
  const [played, setPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [lineIndex, setLineIndex] = useState(-1);
  const { prefs, pickVoice } = useVoice();
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    setPlayed(false);
    setPlaying(false);
    setLineIndex(-1);
    window.speechSynthesis.cancel();
  }, [set.id]);

  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(() => play(), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id, autoPlay]);

  function speakLine(index: number) {
    const line = set.script[index];
    if (!line) {
      setPlaying(false);
      setPlayed(true);
      setLineIndex(-1);
      ended.current?.();
      return;
    }
    const speaker = set.speakers.find((s) => s.id === line.speakerId);
    const utter = new SpeechSynthesisUtterance(line.text);
    utter.lang = langForAccent(speaker?.accent || set.audio.accent);
    utter.rate = prefs.rate;
    utter.volume = prefs.volume;
    const voice = pickVoice(speaker?.gender || "female", speaker?.accent || set.audio.accent);
    if (voice) utter.voice = voice;
    const next = set.script[index + 1];
    const gap = next && next.speakerId !== line.speakerId ? 850 : 380;
    utter.onend = () => {
      window.setTimeout(() => speakLine(index + 1), gap);
    };
    setLineIndex(index);
    window.speechSynthesis.speak(utter);
  }

  function play() {
    if (played && !allowReplay) return;
    setPlaying(true);
    window.speechSynthesis.cancel();
    speakLine(0);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={play}
        disabled={playing || (played && !allowReplay)}
        className="rounded bg-[#1f4e79] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {playing
          ? "Playing…"
          : played && !allowReplay
            ? "Played"
            : set.speakers.length > 1
              ? "Play conversation"
              : "Play"}
      </button>
      {playing && lineIndex >= 0 && (
        <p className="text-xs text-[#5b6775]">
          Now speaking: {set.speakers.find((s) => s.id === set.script[lineIndex]?.speakerId)?.label}
        </p>
      )}
    </div>
  );
}

export function RecordingPlayer({ path }: { path?: string | null }) {
  if (!path) return <p className="text-sm text-[#5b6775]">No recording</p>;
  return <audio controls src={`/api/media?path=${encodeURIComponent(path)}`} className="w-full" />;
}
