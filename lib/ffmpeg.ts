import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const FFMPEG_CANDIDATES = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"];

export function ffmpegBin() {
  return FFMPEG_CANDIDATES.find((bin) => bin === "ffmpeg" || fs.existsSync(bin)) || "ffmpeg";
}

export function audioContentType(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  return "audio/webm";
}

export async function transcodeToMp3(src: string, dest: string): Promise<boolean> {
  try {
    await execFileAsync(
      ffmpegBin(),
      ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-q:a", "4", dest],
      { timeout: 30_000 },
    );
    return fs.existsSync(dest) && fs.statSync(dest).size > 200;
  } catch {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    return false;
  }
}
