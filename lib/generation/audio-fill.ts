import { fillAudio } from "../tts";
import type { TestFormPayload } from "../types";

export async function attachFormAudio(formId: string, form: TestFormPayload): Promise<TestFormPayload> {
  const jobs: Array<Promise<void>> = [];
  let n = 0;
  const next = () => `a${++n}.mp3`;

  const listenBundles = [form.listening.module1, form.listening.module2Lower, form.listening.module2Upper];
  for (const bundle of listenBundles) {
    for (const item of bundle.choose) {
      jobs.push(
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
        jobs.push(
          fillAudio(formId, clip, next()).then((audio) => {
            if (set.lineAudio) set.lineAudio[index] = audio;
          }),
        );
      });
    }
  }
  for (const item of form.speaking.listenRepeat.items) {
    jobs.push(
      fillAudio(formId, item.audio, next()).then((audio) => {
        item.audio = audio;
      }),
    );
  }
  for (const item of form.speaking.interview.items) {
    jobs.push(
      fillAudio(formId, item.audio, next()).then((audio) => {
        item.audio = audio;
      }),
    );
  }

  const limit = 6;
  for (let i = 0; i < jobs.length; i += limit) {
    await Promise.all(jobs.slice(i, i + limit));
  }
  return form;
}
