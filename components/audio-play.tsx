"use client";

import { useEffect, useRef, useState } from "react";
import { langForAccent } from "@/lib/accents";
import { appPath } from "@/lib/base-path";
import type { AudioRef, SpokenSet } from "@/lib/types";
import { applyPlaybackGain, speechVolume } from "@/lib/playback-gain";
import { useVoice } from "./voice/voice-context";

function waitForEnglishVoices(ms = 1200): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => window.speechSynthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith("en"));
    if (ready()) {
      resolve();
      return;
    }
    const started = Date.now();
    const tick = window.setInterval(() => {
      if (ready() || Date.now() - started >= ms) {
        window.clearInterval(tick);
        resolve();
      }
    }, 50);
  });
}

function leadInMs(audio?: AudioRef | null) {
  if (audio?.path && !audio.fallbackTts && audio.padded) return 80;
  return 380;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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
  const gen = useRef(0);
  const ended = useRef(onEnded);
  ended.current = onEnded;

  function stopPlayback() {
    gen.current += 1;
    window.speechSynthesis.cancel();
    ref.current?.pause();
    ref.current = null;
  }

  useEffect(() => {
    setPlayed(false);
    setPlaying(false);
    stopPlayback();
    return () => stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    stopPlayback();
    const token = gen.current;
    setPlaying(true);
    await wait(leadInMs(audio));
    if (token !== gen.current) return;
    if (audio.path && !audio.fallbackTts) {
      const src = appPath(`/api/media?path=${encodeURIComponent(`data/audio/${audio.path}`)}`);
      const el = new Audio(src);
      ref.current = el;
      applyPlaybackGain(el, prefs.volume);
      el.playbackRate = audio.rate ?? 1;
      el.onended = () => {
        if (token !== gen.current) return;
        finish();
      };
      await el.play().catch(() => {
        if (token !== gen.current) return;
        void speak(token);
      });
      return;
    }
    await speak(token);
  }

  async function speak(token = gen.current) {
    if (token !== gen.current) return;
    await waitForEnglishVoices();
    if (token !== gen.current) return;
    const utter = new SpeechSynthesisUtterance(audio.script);
    utter.lang = langForAccent(audio.accent);
    utter.rate = prefs.rate * (audio.rate ?? 1);
    utter.volume = speechVolume(prefs.volume);
    const voice = pickVoice(audio.gender, audio.accent);
    if (voice) utter.voice = voice;
    utter.onend = () => {
      if (token !== gen.current) return;
      finish();
    };
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gen = useRef(0);
  const ended = useRef(onEnded);
  ended.current = onEnded;

  function stopPlayback() {
    gen.current += 1;
    window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
  }

  useEffect(() => {
    setPlayed(false);
    setPlaying(false);
    setLineIndex(-1);
    stopPlayback();
    return () => stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id]);

  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(() => play(), 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id, autoPlay]);

  function finishAll() {
    setPlaying(false);
    setPlayed(true);
    setLineIndex(-1);
    ended.current?.();
  }

  function lineGap(index: number) {
    const line = set.script[index];
    const next = set.script[index + 1];
    const talkPause = set.taskType === "listen_academic_talk" ? 520 : 380;
    return next && next.speakerId !== line?.speakerId ? 850 : talkPause;
  }

  function playLineFile(index: number, token: number) {
    if (token !== gen.current) return;
    if (index >= set.script.length) {
      finishAll();
      return;
    }
    const clip = set.lineAudio?.[index];
    const start = () => {
      if (token !== gen.current) return;
      if (!clip?.path || clip.fallbackTts) {
        void speakLine(index, token);
        return;
      }
      const el = new Audio(appPath(`/api/media?path=${encodeURIComponent(`data/audio/${clip.path}`)}`));
      audioRef.current = el;
      applyPlaybackGain(el, prefs.volume);
      el.playbackRate = clip.rate ?? set.audio.rate ?? 1;
      el.onended = () => {
        if (token !== gen.current) return;
        window.setTimeout(() => playLineFile(index + 1, token), lineGap(index));
      };
      el.onerror = () => speakLine(index, token);
      setLineIndex(index);
      void el.play().catch(() => speakLine(index, token));
    };
    if (index === 0) {
      window.setTimeout(start, leadInMs(clip));
      return;
    }
    start();
  }

  function speakLine(index: number, token: number) {
    if (token !== gen.current) return;
    const line = set.script[index];
    if (!line) {
      finishAll();
      return;
    }
    const speaker = set.speakers.find((s) => s.id === line.speakerId);
    const utter = new SpeechSynthesisUtterance(line.text);
    utter.lang = langForAccent(speaker?.accent || set.audio.accent);
    utter.rate = prefs.rate * (set.audio.rate ?? 1);
    utter.volume = speechVolume(prefs.volume);
    const voice = pickVoice(speaker?.gender || "female", speaker?.accent || set.audio.accent);
    if (voice) utter.voice = voice;
    utter.onend = () => {
      if (token !== gen.current) return;
      window.setTimeout(() => playLineFile(index + 1, token), lineGap(index));
    };
    setLineIndex(index);
    window.speechSynthesis.speak(utter);
  }

  function play() {
    if (played && !allowReplay) return;
    stopPlayback();
    const token = gen.current;
    setPlaying(true);
    playLineFile(0, token);
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
  const { prefs } = useVoice();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (ref.current) applyPlaybackGain(ref.current, prefs.volume);
  }, [path, prefs.volume]);
  if (!path) return <p className="text-sm text-[#5b6775]">No recording was saved for this answer.</p>;
  const src = appPath(`/api/media?path=${encodeURIComponent(path)}`);
  const type = path.endsWith(".mp3")
    ? "audio/mpeg"
    : path.endsWith(".m4a") || path.endsWith(".mp4")
      ? "audio/mp4"
      : path.endsWith(".wav")
        ? "audio/wav"
        : "audio/webm";
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Your recording</p>
      {failed ? (
        <p className="text-sm text-red-700">This recording could not be played. Try another browser, or retake the speaking item.</p>
      ) : (
        <audio
          ref={ref}
          controls
          preload="metadata"
          className="w-full"
          onError={() => setFailed(true)}
        >
          <source src={src} type="audio/mpeg" />
          <source src={src} type={type} />
        </audio>
      )}
    </div>
  );
}
