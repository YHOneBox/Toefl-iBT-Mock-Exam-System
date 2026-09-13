import path from "path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");
export const RECORDINGS_DIR = path.join(DATA_DIR, "recordings");
export const CONSTRAINTS_DIR = path.join(ROOT, "content", "constraints");

export function formAudioDir(formId: string) {
  return path.join(AUDIO_DIR, formId);
}

export function sessionRecordingDir(sessionId: string) {
  return path.join(RECORDINGS_DIR, sessionId);
}
