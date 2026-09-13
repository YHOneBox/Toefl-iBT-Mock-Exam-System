import fs from "fs";
import path from "path";
import type { Accent, AudioRef } from "./types";

const OPENAI_VOICE: Record<Accent, Record<"male" | "female", string>> = {
  us: { female: process.env.OPENAI_TTS_VOICE_US_FEMALE || process.env.OPENAI_TTS_VOICE || "nova", male: process.env.OPENAI_TTS_VOICE_US_MALE || "onyx" },
  uk: { female: process.env.OPENAI_TTS_VOICE_UK_FEMALE || "fable", male: process.env.OPENAI_TTS_VOICE_UK_MALE || "echo" },
  au: { female: process.env.OPENAI_TTS_VOICE_AU_FEMALE || "shimmer", male: process.env.OPENAI_TTS_VOICE_AU_MALE || "verse" },
};

function elevenVoice(accent: Accent, gender: "male" | "female") {
  const specific =
    process.env[`ELEVENLABS_VOICE_${accent.toUpperCase()}_${gender.toUpperCase()}`] ||
    process.env[`ELEVENLABS_VOICE_${accent.toUpperCase()}`];
  if (specific) return specific;
  if (accent === "uk") return process.env.ELEVENLABS_VOICE_UK;
  if (accent === "au") return process.env.ELEVENLABS_VOICE_AU;
  return process.env.ELEVENLABS_VOICE_US;
}

export async function synthesizeToFile(
  filePath: string,
  text: string,
  accent: Accent,
  gender: "male" | "female" = "female",
  speed = 1,
): Promise<boolean> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (process.env.ELEVENLABS_API_KEY) {
    const voice = elevenVoice(accent, gender);
    if (voice) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
          }),
        });
        if (res.ok) {
          fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
          return true;
        }
      } catch {
        /* fall through */
      }
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const res = await fetch(`${base}/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
          voice: OPENAI_VOICE[accent][gender],
          input: text,
          speed: Math.max(0.7, Math.min(1.2, speed)),
        }),
      });
      if (res.ok) {
        fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
        return true;
      }
    } catch {
      /* fall through */
    }
  }
  return false;
}

export async function fillAudio(
  formId: string,
  audio: AudioRef,
  filename: string,
): Promise<AudioRef> {
  const rel = `${formId}/${filename}`;
  const abs = path.join(process.cwd(), "data", "audio", rel);
  const ok = await synthesizeToFile(abs, audio.script, audio.accent, audio.gender, audio.rate ?? 1);
  return { ...audio, path: ok ? rel : undefined, fallbackTts: !ok };
}
