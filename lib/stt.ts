import fs from "fs";

type SttAttempt = {
  name: string;
  transcribe: (buf: Buffer, filename: string) => Promise<string>;
};

function pathName(filePath: string): string {
  return filePath.replaceAll("\\", "/").split("/").pop() || "audio.webm";
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

async function transcribeOpenAiCompatible(opts: {
  url: string;
  apiKey: string;
  model: string;
  buf: Buffer;
  filename: string;
  language?: string;
}): Promise<string> {
  const form = new FormData();
  form.append("model", opts.model);
  form.append("file", new Blob([new Uint8Array(opts.buf)]), opts.filename);
  if (opts.language) form.append("language", opts.language);
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    signal: AbortSignal.timeout(30_000),
    body: form,
  });
  if (!res.ok) throw new Error(`${opts.model} ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}

function groqModels() {
  return unique([process.env.GROQ_WHISPER_MODEL, "whisper-large-v3-turbo", "whisper-large-v3"]);
}

function sttProviders(): SttAttempt[] {
  const providers: SttAttempt[] = [];
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      name: "groq",
      transcribe: async (buf, filename) => {
        let last = "";
        for (const model of groqModels()) {
          try {
            return await transcribeOpenAiCompatible({
              url: "https://api.groq.com/openai/v1/audio/transcriptions",
              apiKey: groqKey,
              model,
              buf,
              filename,
              language: "en",
            });
          } catch (err) {
            last = err instanceof Error ? err.message : String(err);
          }
        }
        throw new Error(last || "Groq Whisper failed");
      },
    });
  }
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    providers.push({
      name: "openai",
      transcribe: (buf, filename) =>
        transcribeOpenAiCompatible({
          url: `${base}/audio/transcriptions`,
          apiKey: openaiKey,
          model: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
          buf,
          filename,
        }),
    });
  }
  return providers;
}

export function hasSttKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

export function sttPresence() {
  return {
    groq: Boolean(process.env.GROQ_API_KEY?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };
}

export async function transcribeFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) return "";
  const buf = fs.readFileSync(filePath);
  if (!buf.length) return "";
  const filename = pathName(filePath);
  for (const provider of sttProviders()) {
    try {
      const text = await provider.transcribe(buf, filename);
      if (text) return text;
    } catch {
      /* try the next provider */
    }
  }
  return "";
}
