import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import type { Accent, AudioRef } from "./types";

const execFileAsync = promisify(execFile);
const LEAD_SILENCE_MS = 400;
const FFMPEG_CANDIDATES = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"];

function ffmpegBin() {
  return FFMPEG_CANDIDATES.find((bin) => bin === "ffmpeg" || fs.existsSync(bin)) || "ffmpeg";
}

function leadMarker(filePath: string) {
  return `${filePath}.leadok`;
}

export type TtsStyle = "narrator" | "speaker";

const OPENAI_VOICE: Record<Accent, Record<"male" | "female", string>> = {
  us: { female: process.env.OPENAI_TTS_VOICE_US_FEMALE || process.env.OPENAI_TTS_VOICE || "nova", male: process.env.OPENAI_TTS_VOICE_US_MALE || "onyx" },
  uk: { female: process.env.OPENAI_TTS_VOICE_UK_FEMALE || "fable", male: process.env.OPENAI_TTS_VOICE_UK_MALE || "echo" },
  au: { female: process.env.OPENAI_TTS_VOICE_AU_FEMALE || "shimmer", male: process.env.OPENAI_TTS_VOICE_AU_MALE || "verse" },
};

const NARRATOR_INSTRUCTIONS =
  "Speak as a TOEFL exam narrator. Clear, calm American English. Natural pacing, even volume, no drama, no whisper. Pronounce campus names and instructions plainly.";

const SPEAKER_INSTRUCTIONS =
  "Speak as a person in a campus or classroom recording. Natural conversational American, British, or Australian English matching the requested accent. Clear consonants. No extra emotion.";

function elevenVoice(accent: Accent, gender: "male" | "female") {
  const specific =
    process.env[`ELEVENLABS_VOICE_${accent.toUpperCase()}_${gender.toUpperCase()}`] ||
    process.env[`ELEVENLABS_VOICE_${accent.toUpperCase()}`];
  if (specific) return specific;
  if (accent === "uk") return process.env.ELEVENLABS_VOICE_UK;
  if (accent === "au") return process.env.ELEVENLABS_VOICE_AU;
  return process.env.ELEVENLABS_VOICE_US;
}

function narratorVoiceId() {
  return process.env.OPENAI_TTS_NARRATOR_VOICE || process.env.OPENAI_TTS_VOICE || "nova";
}

function openaiVoice(accent: Accent, gender: "male" | "female", style: TtsStyle) {
  if (style === "narrator") return narratorVoiceId();
  return OPENAI_VOICE[accent][gender];
}

function cacheRel(audio: AudioRef, style: TtsStyle) {
  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const voice = openaiVoice(audio.accent, audio.gender, style);
  const digest = createHash("sha1")
    .update([style, model, voice, audio.accent, audio.gender, audio.rate ?? 1, `lead${LEAD_SILENCE_MS}`, audio.script].join("\n"))
    .digest("hex");
  return `cache/${digest}.mp3`;
}

function fileReady(filePath: string) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 800;
  } catch {
    return false;
  }
}

async function prependSilence(filePath: string): Promise<boolean> {
  const tmp = `${filePath}.lead.mp3`;
  try {
    await execFileAsync(
      ffmpegBin(),
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-af",
        `adelay=${LEAD_SILENCE_MS}:all=1`,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "4",
        tmp,
      ],
      { timeout: 20_000 },
    );
    if (fileReady(tmp)) {
      fs.renameSync(tmp, filePath);
      fs.writeFileSync(leadMarker(filePath), String(LEAD_SILENCE_MS));
      return true;
    }
  } catch {
    /* keep the unpadded file */
  }
  try {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return false;
}

async function synthesizeToFile(
  filePath: string,
  text: string,
  accent: Accent,
  gender: "male" | "female" = "female",
  speed = 1,
  style: TtsStyle = "speaker",
): Promise<"padded" | "raw" | false> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (process.env.ELEVENLABS_API_KEY) {
    const voice = style === "narrator" ? process.env.ELEVENLABS_VOICE_NARRATOR || elevenVoice("us", "female") : elevenVoice(accent, gender);
    if (voice) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: style === "narrator" ? 0.55 : 0.4,
              similarity_boost: 0.8,
              style: style === "narrator" ? 0.05 : 0.2,
              use_speaker_boost: true,
            },
          }),
        });
        if (res.ok) {
          fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
          if (await prependSilence(filePath)) return "padded";
          return fileReady(filePath) ? "raw" : false;
        }
      } catch {
        /* fall through */
      }
    }
  }
  if (process.env.OPENAI_API_KEY) {
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const body = {
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: openaiVoice(accent, gender, style),
      input: text,
      speed: Math.max(0.85, Math.min(1.05, style === "narrator" ? 0.95 : speed)),
      instructions: style === "narrator" ? NARRATOR_INSTRUCTIONS : SPEAKER_INSTRUCTIONS,
    };
    try {
      let res = await fetch(`${base}/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { instructions: _ignored, ...plain } = body;
        res = await fetch(`${base}/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify(plain),
        });
      }
      if (res.ok) {
        fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
        if (await prependSilence(filePath)) return "padded";
        return fileReady(filePath) ? "raw" : false;
      }
    } catch {
      /* fall through */
    }
  }
  return false;
}

export function narratorAudio(script: string): AudioRef {
  return { script, accent: "us", gender: "female", fallbackTts: true, rate: 0.95 };
}

export async function fillAudio(
  formId: string,
  audio: AudioRef,
  filename: string,
  style: TtsStyle = "speaker",
): Promise<AudioRef> {
  const cached = cacheRel(audio, style);
  const cacheAbs = path.join(process.cwd(), "data", "audio", cached);
  if (fileReady(cacheAbs)) {
    const marked = fs.existsSync(leadMarker(cacheAbs));
    const padded = marked || (await prependSilence(cacheAbs));
    return { ...audio, path: cached, fallbackTts: false, padded };
  }
  const result = await synthesizeToFile(cacheAbs, audio.script, audio.accent, audio.gender, audio.rate ?? 1, style);
  if (result && fileReady(cacheAbs)) {
    return { ...audio, path: cached, fallbackTts: false, padded: result === "padded" };
  }
  const rel = `${formId}/${filename}`;
  const abs = path.join(process.cwd(), "data", "audio", rel);
  const fallback = await synthesizeToFile(abs, audio.script, audio.accent, audio.gender, audio.rate ?? 1, style);
  return { ...audio, path: fallback ? rel : undefined, fallbackTts: !fallback, padded: fallback === "padded" };
}
