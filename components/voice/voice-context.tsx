"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCENT_LABEL, ACCENTS, accentLangPrefixes, emptyAccentMap } from "@/lib/accents";
import { clampVolume, speechVolume, VOLUME_MAX, VOLUME_MIN } from "@/lib/playback-gain";
import type { Accent } from "@/lib/types";

export type VoicePrefs = {
  male: Record<Accent, string>;
  female: Record<Accent, string>;
  rate: number;
  volume: number;
};

const DEFAULT: VoicePrefs = { male: emptyAccentMap(), female: emptyAccentMap(), rate: 0.95, volume: 1 };
const KEY = "toefl-voice-prefs";

type VoiceContextValue = {
  prefs: VoicePrefs;
  voices: SpeechSynthesisVoice[];
  setPrefs: (next: Partial<VoicePrefs>) => void;
  setAccentVoice: (gender: "male" | "female", accent: Accent, voiceURI: string) => void;
  pickVoice: (gender: "male" | "female", accent?: Accent) => SpeechSynthesisVoice | null;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

function loadPrefs(): VoicePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as {
      male?: string | Record<Accent, string>;
      female?: string | Record<Accent, string>;
      rate?: number;
      volume?: number;
    };
    return {
      rate: typeof parsed.rate === "number" ? parsed.rate : DEFAULT.rate,
      volume: typeof parsed.volume === "number" ? clampVolume(parsed.volume) : DEFAULT.volume,
      male: normalizeAccentMap(parsed.male),
      female: normalizeAccentMap(parsed.female),
    };
  } catch {
    return DEFAULT;
  }
}

function normalizeAccentMap(value: string | Record<Accent, string> | undefined): Record<Accent, string> {
  const empty = emptyAccentMap();
  if (!value) return empty;
  if (typeof value === "string") return { ...empty, us: value };
  return { ...empty, ...value };
}

function matchesAccent(voice: SpeechSynthesisVoice, accent: Accent) {
  const lang = voice.lang.toLowerCase();
  return accentLangPrefixes(accent).some((prefix) => lang.startsWith(prefix));
}

function matchesGender(voice: SpeechSynthesisVoice, gender: "male" | "female") {
  const name = voice.name;
  if (gender === "male") {
    return /male|david|daniel|george|james|mark|ryan|guy|andrew|thomas|christopher|eric|roger|matthew|brian|oliver|william|richard/i.test(
      name,
    );
  }
  return /female|zira|samantha|susan|hazel|jenny|aria|sonia|woman|catherine|natasha|michelle|linda|karen|moira|tessa|salli|ivy|joanna|kendra|kimberly|nicole/i.test(
    name,
  );
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<VoicePrefs>(DEFAULT);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setPrefsState(loadPrefs());
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const value = useMemo<VoiceContextValue>(() => {
    return {
      prefs,
      voices,
      setPrefs: (next) => {
        setPrefsState((prev) => {
          const merged = { ...prev, ...next };
          localStorage.setItem(KEY, JSON.stringify(merged));
          return merged;
        });
      },
      setAccentVoice: (gender, accent, voiceURI) => {
        setPrefsState((prev) => {
          const merged = {
            ...prev,
            [gender]: { ...prev[gender], [accent]: voiceURI },
          };
          localStorage.setItem(KEY, JSON.stringify(merged));
          return merged;
        });
      },
      pickVoice: (gender, accent = "us") => {
        if (!voices.length) return null;
        const chosen = prefs[gender][accent];
        const exact = chosen ? voices.find((v) => v.voiceURI === chosen) : null;
        if (exact) return exact;
        const accented = voices.filter((v) => matchesAccent(v, accent));
        const genderedAccent = accented.filter((v) => matchesGender(v, gender));
        const gendered = voices.filter((v) => matchesGender(v, gender));
        return genderedAccent[0] || accented[0] || gendered[0] || voices[0] || null;
      },
    };
  }, [prefs, voices]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("VoiceProvider missing");
  return ctx;
}

export function VoiceControls({ compact = false }: { compact?: boolean }) {
  const { prefs, voices, setPrefs, setAccentVoice } = useVoice();
  return (
    <div className={compact ? "space-y-2 text-xs" : "space-y-3 text-sm"}>
      {(["male", "female"] as const).map((gender) => (
        <div key={gender}>
          <div className="mb-1 font-semibold capitalize">{gender} accents</div>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((accent) => (
              <label key={`${gender}-${accent}`} className="flex items-center gap-1">
                <span>{ACCENT_LABEL[accent]}</span>
                <select
                  value={prefs[gender][accent]}
                  onChange={(e) => setAccentVoice(gender, accent, e.target.value)}
                  className="max-w-44 border bg-white px-1 py-0.5 text-black"
                >
                  <option value="">Auto</option>
                  {voicesForAccent(voices, accent).map((v) => (
                    <option key={`${gender}-${accent}-${v.voiceURI}`} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ))}
      <VolumeSlider showTest />
      <label className="flex items-center gap-1">
        <span>Speed</span>
        <input
          type="range"
          min="0.7"
          max="1.15"
          step="0.05"
          value={prefs.rate}
          onChange={(e) => setPrefs({ rate: Number(e.target.value) })}
        />
        <span>{prefs.rate.toFixed(2)}</span>
      </label>
    </div>
  );
}

export function VolumeSlider({
  label = "Volume",
  showTest = false,
}: {
  label?: string;
  showTest?: boolean;
}) {
  const { prefs, setPrefs, pickVoice } = useVoice();
  const [testing, setTesting] = useState(false);

  function playTest() {
    setTesting(true);
    window.speechSynthesis.cancel();
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0.08 * clampVolume(prefs.volume);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      osc.onended = () => void ctx.close();
    } catch {
      /* speech is enough */
    }
    const utter = new SpeechSynthesisUtterance(
      "This is a volume check. Adjust the slider until this is comfortable.",
    );
    utter.lang = "en-US";
    utter.rate = prefs.rate;
    utter.volume = speechVolume(prefs.volume);
    const voice = pickVoice("female", "us");
    if (voice) utter.voice = voice;
    utter.onend = () => setTesting(false);
    utter.onerror = () => setTesting(false);
    window.setTimeout(() => window.speechSynthesis.speak(utter), 220);
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span>{label}</span>
        <input
          type="range"
          min={VOLUME_MIN}
          max={VOLUME_MAX}
          step="0.05"
          value={prefs.volume}
          onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
        />
        <span className="tabular-nums">{Math.round(prefs.volume * 100)}%</span>
      </label>
      {showTest && (
        <button
          type="button"
          onClick={playTest}
          className="rounded border border-[#c5d0da] bg-white px-3 py-1.5 text-sm"
        >
          {testing ? "Playing test…" : "Test volume"}
        </button>
      )}
    </div>
  );
}

function voicesForAccent(voices: SpeechSynthesisVoice[], accent: Accent) {
  const matched = voices.filter((v) => matchesAccent(v, accent));
  return matched.length ? matched : voices;
}
