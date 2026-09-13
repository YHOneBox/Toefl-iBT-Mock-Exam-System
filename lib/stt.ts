import fs from "fs";

export async function transcribeFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) return "";
  if (!process.env.OPENAI_API_KEY) return "";
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("model", process.env.OPENAI_WHISPER_MODEL || "whisper-1");
  form.append("file", new Blob([buf]), pathName(filePath));
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { text?: string };
  return data.text || "";
}

function pathName(filePath: string): string {
  return filePath.replaceAll("\\", "/").split("/").pop() || "audio.webm";
}
