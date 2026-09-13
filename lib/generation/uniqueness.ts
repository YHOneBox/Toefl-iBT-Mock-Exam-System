import type { ListeningBundle, ReadingBundle, TestFormPayload } from "../types";
import { contentKey, isSeenKey, rememberKeysForText, spokenJoinKey } from "./content-key";

type Clip = { where: string; key: string; clip: string };

function addClip(list: Clip[], where: string, text: string) {
  const key = contentKey(text);
  if (!key) return;
  list.push({ where, key, clip: key.slice(0, 96) });
}

function readingBundles(form: TestFormPayload): Array<[string, ReadingBundle]> {
  return [
    ["Reading M1", form.reading.module1],
    ["Reading M2 lower", form.reading.module2Lower],
    ["Reading M2 upper", form.reading.module2Upper],
  ];
}

function listeningBundles(form: TestFormPayload): Array<[string, ListeningBundle]> {
  return [
    ["Listening M1", form.listening.module1],
    ["Listening M2 lower", form.listening.module2Lower],
    ["Listening M2 upper", form.listening.module2Upper],
  ];
}

function allSpoken(bundle: ListeningBundle) {
  return [...bundle.conversations, ...bundle.announcements, ...bundle.talks];
}

function dupErrors(clips: Clip[], kind: string): string[] {
  const errors: string[] = [];
  const byKey = new Map<string, string[]>();
  const byClip = new Map<string, Clip[]>();
  for (const clip of clips) {
    const wheres = byKey.get(clip.key) || [];
    wheres.push(clip.where);
    byKey.set(clip.key, wheres);
    if (clip.clip.length >= 96) {
      const group = byClip.get(clip.clip) || [];
      group.push(clip);
      byClip.set(clip.clip, group);
    }
  }
  for (const wheres of byKey.values()) {
    const unique = [...new Set(wheres)];
    if (unique.length > 1) errors.push(`Duplicate ${kind}: ${unique.join(" | ")}`);
  }
  for (const group of byClip.values()) {
    const keys = new Set(group.map((row) => row.key));
    if (keys.size < 2) continue;
    const unique = [...new Set(group.map((row) => row.where))];
    if (unique.length > 1) {
      errors.push(`Near-duplicate ${kind} (same opening): ${unique.join(" | ")}`);
    }
  }
  return errors;
}

function collectAudioClips(form: TestFormPayload): Clip[] {
  const audio: Clip[] = [];
  for (const [label, bundle] of listeningBundles(form)) {
    for (const item of bundle.choose) {
      addClip(audio, `${label} listen-choose`, item.audio.script);
    }
    for (const set of allSpoken(bundle)) {
      set.script.forEach((line, index) => {
        addClip(audio, `${label} "${set.title}" line ${index + 1}`, line.text);
      });
    }
  }
  form.speaking.listenRepeat.items.forEach((item, index) => {
    addClip(audio, `Listen and Repeat ${index + 1}`, item.sentence);
  });
  form.speaking.interview.items.forEach((item, index) => {
    addClip(audio, `Interview ${index + 1}`, item.prompt);
  });
  return audio;
}

function collectSpokenSetClips(form: TestFormPayload): Clip[] {
  const sets: Clip[] = [];
  for (const [label, bundle] of listeningBundles(form)) {
    for (const set of allSpoken(bundle)) {
      addClip(sets, `${label} "${set.title}"`, set.script.map((line) => line.text).join(" "));
    }
  }
  return sets;
}

function collectPassageClips(form: TestFormPayload): Clip[] {
  const passages: Clip[] = [];
  for (const [label, bundle] of readingBundles(form)) {
    for (const set of bundle.completeTheWords) addClip(passages, `${label} CTW`, set.fullPassage);
    for (const set of bundle.dailyLife) addClip(passages, `${label} daily "${set.title}"`, set.text);
    for (const set of bundle.academic) addClip(passages, `${label} academic "${set.title}"`, set.text);
  }
  for (const item of form.writing.sentences) addClip(passages, "Build a sentence", item.exchange);
  addClip(passages, "Email scenario", form.writing.email.scenario || "");
  addClip(passages, "Discussion prompt", form.writing.discussion.prompt || "");
  addClip(passages, "Listen and Repeat scenario", form.speaking.listenRepeat.scenario || "");
  addClip(passages, "Interview scenario", form.speaking.interview.scenario || "");
  return passages;
}

function sameSetStemErrors(form: TestFormPayload): string[] {
  const errors: string[] = [];
  const check = (where: string, stems: string[]) => {
    const keys = stems.map((stem) => contentKey(stem)).filter(Boolean);
    if (new Set(keys).size !== keys.length) errors.push(`Duplicate question stems in ${where}`);
  };
  for (const [label, bundle] of readingBundles(form)) {
    for (const set of [...bundle.dailyLife, ...bundle.academic]) {
      check(`${label} "${set.title}"`, set.questions.map((question) => question.stem));
    }
  }
  for (const [label, bundle] of listeningBundles(form)) {
    for (const set of allSpoken(bundle)) {
      check(`${label} "${set.title}"`, set.questions.map((question) => question.stem));
    }
  }
  return errors;
}

function collectAudioPaths(form: TestFormPayload): string[] {
  const errors: string[] = [];
  const byPath = new Map<string, string[]>();
  const add = (where: string, path?: string) => {
    if (!path) return;
    const list = byPath.get(path) || [];
    list.push(where);
    byPath.set(path, list);
  };
  for (const [label, bundle] of listeningBundles(form)) {
    for (const item of bundle.choose) add(`${label} listen-choose`, item.audio.path);
    for (const set of allSpoken(bundle)) {
      set.lineAudio?.forEach((clip, index) => add(`${label} "${set.title}" line ${index + 1}`, clip.path));
    }
  }
  form.speaking.listenRepeat.items.forEach((item, index) => add(`Listen and Repeat ${index + 1}`, item.audio.path));
  form.speaking.interview.items.forEach((item, index) => add(`Interview ${index + 1}`, item.audio.path));
  for (const [path, wheres] of byPath) {
    const unique = [...new Set(wheres)];
    if (unique.length > 1) errors.push(`Duplicate audio file ${path}: ${unique.join(" | ")}`);
  }
  return errors;
}

export function uniquenessIssues(form: TestFormPayload): string[] {
  return [
    ...dupErrors(collectAudioClips(form), "audio"),
    ...dupErrors(collectSpokenSetClips(form), "spoken set"),
    ...dupErrors(collectPassageClips(form), "text"),
    ...sameSetStemErrors(form),
    ...collectAudioPaths(form),
  ];
}

export function collectFormTexts(form: TestFormPayload): string[] {
  const texts: string[] = [];
  for (const [, bundle] of readingBundles(form)) {
    for (const set of bundle.completeTheWords) texts.push(set.fullPassage);
    for (const set of bundle.dailyLife) texts.push(set.title, set.text);
    for (const set of bundle.academic) texts.push(set.title, set.text);
  }
  for (const [, bundle] of listeningBundles(form)) {
    for (const item of bundle.choose) texts.push(item.audio.script);
    for (const set of allSpoken(bundle)) {
      texts.push(set.title, spokenJoinKey(set.script), ...set.script.map((line) => line.text));
    }
  }
  for (const item of form.writing.sentences) texts.push(item.exchange);
  texts.push(form.writing.email.scenario || "", form.writing.discussion.prompt || "");
  texts.push(form.speaking.listenRepeat.scenario || "", form.speaking.interview.scenario || "");
  for (const item of form.speaking.listenRepeat.items) texts.push(item.sentence);
  for (const item of form.speaking.interview.items) texts.push(item.prompt);
  return texts.filter(Boolean);
}

export function collectFormContentKeys(form: TestFormPayload): string[] {
  return [...new Set(collectFormTexts(form).map((text) => contentKey(text)).filter(Boolean))];
}

export function keysForRemember(form: TestFormPayload): string[] {
  return [...new Set(collectFormTexts(form).flatMap((text) => rememberKeysForText(text)))];
}

export function labelsFromUniqueness(form: TestFormPayload): string[] {
  const labels = [...form.topics];
  for (const [, bundle] of readingBundles(form)) {
    for (const set of bundle.dailyLife) labels.push(set.title);
    for (const set of bundle.academic) labels.push(set.title);
  }
  for (const [, bundle] of listeningBundles(form)) {
    for (const item of bundle.choose) labels.push(item.audio.script.slice(0, 80));
    for (const set of allSpoken(bundle)) labels.push(set.title);
  }
  if (form.writing.email.scenario) labels.push(form.writing.email.scenario.slice(0, 80));
  if (form.writing.discussion.course) labels.push(form.writing.discussion.course);
  if (form.writing.discussion.prompt) labels.push(form.writing.discussion.prompt.slice(0, 80));
  labels.push(form.speaking.listenRepeat.setting, form.speaking.interview.interviewer);
  return [...new Set(labels.filter(Boolean))].slice(0, 160);
}

export function reusedSeenKeys(form: TestFormPayload, seen: Set<string>): string[] {
  return collectFormContentKeys(form).filter((key) => isSeenKey(seen, key));
}
