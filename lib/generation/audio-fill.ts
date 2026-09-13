import { throwIfAborted } from "../abort";
import { fillAudio } from "../tts";
import type { TestFormPayload } from "../types";
import { contentKey } from "./content-key";
import { uniquenessIssues } from "./uniqueness";

export async function attachFormAudio(
  formId: string,
  form: TestFormPayload,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<TestFormPayload> {
  const issues = uniquenessIssues(form);
  if (issues.length) {
    throw new Error(`Cannot create audio for a paper with duplicate content: ${issues.join("; ")}`);
  }
  const tasks: Array<() => Promise<void>> = [];
  let n = 0;
  const next = () => `a${++n}.mp3`;
  const usedScripts = new Set<string>();
  const claimScript = (script: string, label: string) => {
    const key = contentKey(script);
    if (!key) return;
    if (usedScripts.has(key)) {
      throw new Error(`Refusing to synthesize the same audio twice (${label}).`);
    }
    usedScripts.add(key);
  };

  const listenBundles = [form.listening.module1, form.listening.module2Lower, form.listening.module2Upper];
  for (const bundle of listenBundles) {
    for (const item of bundle.choose) {
      claimScript(item.audio.script, "listen-choose");
      tasks.push(() =>
        fillAudio(formId, item.audio, next()).then((audio) => {
          item.audio = audio;
        }),
      );
    }
    for (const set of [...bundle.conversations, ...bundle.announcements, ...bundle.talks]) {
      set.lineAudio = set.script.map((line) => {
        const speaker = set.speakers.find((s) => s.id === line.speakerId) || set.speakers[0];
        return {
          script: line.text,
          accent: speaker?.accent || set.audio.accent,
          gender: speaker?.gender || set.audio.gender,
          fallbackTts: true,
          rate: set.audio.rate,
        };
      });
      set.lineAudio.forEach((clip, index) => {
        claimScript(clip.script, `${set.title} line ${index + 1}`);
        tasks.push(() =>
          fillAudio(formId, clip, next()).then((audio) => {
            if (set.lineAudio) set.lineAudio[index] = audio;
          }),
        );
      });
    }
  }
  for (const item of form.speaking.listenRepeat.items) {
    claimScript(item.sentence, "listen-repeat");
    tasks.push(() =>
      fillAudio(formId, item.audio, next()).then((audio) => {
        item.audio = audio;
      }),
    );
  }
  for (const item of form.speaking.interview.items) {
    claimScript(item.prompt, "interview");
    tasks.push(() =>
      fillAudio(formId, item.audio, next()).then((audio) => {
        item.audio = audio;
      }),
    );
  }

  const total = tasks.length;
  let done = 0;
  const limit = 6;
  for (let i = 0; i < tasks.length; i += limit) {
    throwIfAborted(signal);
    await Promise.all(tasks.slice(i, i + limit).map((run) => run()));
    done = Math.min(total, i + limit);
    onProgress?.(done, total);
  }
  return form;
}
