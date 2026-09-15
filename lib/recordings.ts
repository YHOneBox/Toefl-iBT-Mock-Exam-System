import fs from "fs";
import path from "path";
import { audioContentType, transcodeToMp3 } from "./ffmpeg";
import { sessionRecordingDir } from "./paths";

function extFromMime(mime: string, filename: string) {
  const type = mime.toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  const fromName = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
  if (fromName && ["mp3", "m4a", "mp4", "wav", "ogg", "webm"].includes(fromName)) {
    return fromName === "mp4" ? "m4a" : fromName;
  }
  return "webm";
}

export async function persistSpeakingRecording(sessionId: string, itemId: string, buffer: Buffer, mime: string, filename: string) {
  const dir = sessionRecordingDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const srcExt = extFromMime(mime, filename);
  const rawAbs = path.join(dir, `${itemId}.${srcExt}`);
  const mp3Abs = path.join(dir, `${itemId}.mp3`);
  fs.writeFileSync(rawAbs, buffer);
  const mp3Ok = srcExt === "mp3" || (await transcodeToMp3(rawAbs, mp3Abs));
  const abs = mp3Ok && fs.existsSync(mp3Abs) ? mp3Abs : rawAbs;
  const file = path.basename(abs);
  const rel = path.join("data", "recordings", sessionId, file).replaceAll("\\", "/");
  return { abs, rel };
}

export async function playableRecordingFile(abs: string) {
  const mp3 = abs.replace(/\.[^.]+$/, ".mp3");
  if (abs.toLowerCase().endsWith(".mp3") && fs.existsSync(abs) && fs.statSync(abs).size > 200) {
    return { abs, type: "audio/mpeg" as const };
  }
  if (fs.existsSync(mp3) && fs.statSync(mp3).size > 200) {
    return { abs: mp3, type: "audio/mpeg" as const };
  }
  if (!fs.existsSync(abs)) return null;
  if (await transcodeToMp3(abs, mp3)) {
    return { abs: mp3, type: "audio/mpeg" as const };
  }
  return { abs, type: audioContentType(abs) };
}
