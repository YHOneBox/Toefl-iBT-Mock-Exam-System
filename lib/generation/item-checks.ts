import { normalizeText, splitSentences, wordCount } from "../passage";
import type {
  AcademicSeed,
  ChooseSeed,
  CtwSeed,
  DailySeed,
  DiscussionSeed,
  EmailSeed,
  InterviewSeed,
  RepeatSeed,
  SentenceSeed,
  SpokenSeed,
} from "./seeds";
import { buildCompleteTheWords } from "./ctw";

export function quotesStimulus(option: string, stimulus: string): boolean {
  const needle = normalizeText(option);
  const hay = normalizeText(stimulus);
  if (!needle || needle.length < 18) return false;
  if (hay.includes(needle)) return true;
  const words = needle.split(" ").filter((word) => word.length > 2);
  if (words.length < 6) return false;
  for (let i = 0; i <= words.length - 6; i += 1) {
    if (hay.includes(words.slice(i, i + 6).join(" "))) return true;
  }
  return false;
}

function stemErrors(stems: string[], label: string): string[] {
  const errors: string[] = [];
  const keys = stems.map((stem) => normalizeText(stem)).filter(Boolean);
  if (keys.some((key) => key.length < 8)) errors.push(`${label} has a missing or generic stem`);
  if (new Set(keys).size !== keys.length) errors.push(`${label} has duplicate question stems`);
  return errors;
}

function optionErrors(options: string[], stimulus: string, label: string): string[] {
  const errors: string[] = [];
  if (options.length !== 4) errors.push(`${label} needs 4 options`);
  if (options.some((opt) => !opt || opt.trim().length < 2)) errors.push(`${label} has an empty option`);
  const unique = new Set(options.map((opt) => normalizeText(opt)));
  if (unique.size < options.length) errors.push(`${label} has duplicate options`);
  return errors;
}

export function checkCtwSeed(seed: CtwSeed): string[] {
  const errors: string[] = [];
  const words = wordCount(seed.text);
  if (words < 70 || words > 100) errors.push(`CTW word count ${words} (need 70-100)`);
  const sentences = splitSentences(seed.text);
  if (sentences.length < 3) errors.push("CTW needs at least 3 sentences");
  const built = buildCompleteTheWords(seed.text, seed.topic || "Topic", "m1", "B1");
  const gaps = built.tokens.filter((token) => token.isGap);
  if (gaps.length !== 10) errors.push(`CTW built ${gaps.length} gaps`);
  const answers = gaps.map((gap) => (gap.answer || "").toLowerCase());
  if (new Set(answers).size < 8) errors.push("CTW gap endings are too repetitive");
  return errors;
}

export function checkDailySeed(seed: DailySeed): string[] {
  const errors: string[] = [];
  const words = wordCount(seed.text);
  if (words < 15 || words > 150) errors.push(`Daily text ${words} words`);
  if (!seed.title || !seed.format || !seed.topic) errors.push("Daily seed missing title, format, or topic");
  if (seed.questions.length < 2 || seed.questions.length > 3) errors.push("Daily needs 2-3 questions");
  errors.push(...stemErrors(seed.questions.map((q) => q.stem), "Daily"));
  seed.questions.forEach((q, i) => {
    errors.push(...optionErrors(q.options, seed.text, `Daily Q${i + 1}`));
    if (q.answerKey < 0 || q.answerKey > 3) errors.push(`Daily Q${i + 1} answerKey`);
    if (quotesStimulus(q.options[q.answerKey] || "", seed.text)) {
      errors.push(`Daily Q${i + 1} correct option quotes the text`);
    }
  });
  return errors;
}

export function checkAcademicSeed(seed: AcademicSeed): string[] {
  const errors: string[] = [];
  const words = wordCount(seed.text);
  if (words < 170 || words > 240) errors.push(`Academic passage ${words} words (need ~200)`);
  if (seed.questions.length !== 5) errors.push("Academic needs 5 questions");
  errors.push(...stemErrors(seed.questions.map((q) => q.stem), "Academic"));
  const sentences = splitSentences(seed.text);
  if (sentences.length < 5) errors.push("Academic passage needs at least 5 sentences");
  const insert = seed.questions.find((q) => q.passageAction === "insert" || q.insertSentence || /insert/i.test(q.skill));
  if (!insert?.insertSentence) errors.push("Academic needs an insert-text sentence");
  seed.questions.forEach((q, i) => {
    if (q.passageAction === "select") {
      if (q.answerKey < 0 || q.answerKey >= sentences.length) errors.push(`Academic Q${i + 1} select index`);
      return;
    }
    errors.push(...optionErrors(q.options, seed.text, `Academic Q${i + 1}`));
    if (q.answerKey < 0 || q.answerKey > 3) errors.push(`Academic Q${i + 1} answerKey`);
    if (q.passageAction !== "insert" && quotesStimulus(q.options[q.answerKey] || "", seed.text)) {
      errors.push(`Academic Q${i + 1} correct option quotes the text`);
    }
  });
  return errors;
}

export function checkChooseSeed(seed: ChooseSeed): string[] {
  const errors: string[] = [];
  const words = wordCount(seed.script);
  if (words < 6 || words > 42) errors.push(`Listen-choose script ${words} words`);
  errors.push(...optionErrors(seed.options, seed.script, "Listen-choose"));
  if (seed.answerKey < 0 || seed.answerKey > 3) errors.push("Listen-choose answerKey");
  return errors;
}

function spokenWordCount(seed: SpokenSeed): number {
  return wordCount(seed.script.map((line) => line.text).join(" "));
}

export function checkSpokenSeed(seed: SpokenSeed): string[] {
  const errors: string[] = [];
  const words = spokenWordCount(seed);
  if (seed.taskType === "listen_conversation" && (words < 35 || words > 100)) {
    errors.push(`Conversation ${words} words`);
  }
  if (seed.taskType === "listen_announcement" && (words < 40 || words > 85)) {
    errors.push(`Announcement ${words} words`);
  }
  if (seed.taskType === "listen_academic_talk" && (words < 175 || words > 250)) {
    errors.push(`Talk ${words} words`);
  }
  if (!seed.title || !seed.topic) errors.push("Spoken seed missing title or topic");
  if (!seed.speakers.length || !seed.script.length) errors.push("Spoken seed missing speakers or script");
  const lineKeys = seed.script.map((line) => normalizeText(line.text)).filter(Boolean);
  if (new Set(lineKeys).size !== lineKeys.length) errors.push("Spoken seed has duplicate lines");
  const need = seed.taskType === "listen_academic_talk" ? 4 : 2;
  if (seed.questions.length !== need) errors.push(`${seed.taskType} needs ${need} questions`);
  errors.push(...stemErrors(seed.questions.map((q) => q.stem), seed.title || seed.taskType));
  const stimulus = seed.script.map((line) => line.text).join(" ");
  seed.questions.forEach((q, i) => {
    errors.push(...optionErrors(q.options, stimulus, `${seed.title} Q${i + 1}`));
    if (q.answerKey < 0 || q.answerKey > 3) errors.push(`${seed.title} Q${i + 1} answerKey`);
    if (quotesStimulus(q.options[q.answerKey] || "", stimulus)) {
      errors.push(`${seed.title} Q${i + 1} quotes the script`);
    }
  });
  return errors;
}

export function checkSentenceSeed(seed: SentenceSeed): string[] {
  const errors: string[] = [];
  if (!seed.exchange || seed.tokens.length < 5 || seed.answer.length < 5) {
    errors.push("Sentence item is too short");
  }
  const bagA = [...seed.tokens].map((t) => t.trim()).filter(Boolean).sort().join("|");
  const bagB = [...seed.answer].map((t) => t.trim()).filter(Boolean).sort().join("|");
  if (bagA !== bagB) errors.push("Sentence tokens do not match the answer bag");
  return errors;
}

export function checkRepeatSeed(seed: RepeatSeed): string[] {
  const errors: string[] = [];
  if (!seed.scenario || !seed.setting) errors.push("Repeat missing scenario");
  if (seed.sentences.length !== 7) errors.push("Repeat needs 7 sentences");
  if (new Set(seed.sentences.map((s) => normalizeText(s))).size !== seed.sentences.length) {
    errors.push("Repeat has duplicate sentences");
  }
  const lengths = seed.sentences.map((s) => wordCount(s));
  if (lengths.some((n) => n < 4 || n > 28)) errors.push("Repeat sentence length out of range");
  return errors;
}

export function checkInterviewSeed(seed: InterviewSeed): string[] {
  const errors: string[] = [];
  if (!seed.scenario || !seed.interviewer) errors.push("Interview missing scenario");
  if (seed.questions.length !== 4) errors.push("Interview needs 4 questions");
  if (new Set(seed.questions.map((q) => normalizeText(q))).size !== seed.questions.length) {
    errors.push("Interview has duplicate prompts");
  }
  return errors;
}

export function checkEmailSeed(seed: EmailSeed): string[] {
  const errors: string[] = [];
  if (!seed.scenario || seed.scenario.trim().length < 40) errors.push("Email scenario is too short");
  if (!seed.audience || seed.audience.trim().length < 3) errors.push("Email missing audience");
  if (!seed.goal || seed.goal.trim().length < 8) errors.push("Email missing goal");
  if (seed.sampleAnswer && seed.sampleAnswer.trim().length < 60) errors.push("Email sample answer is too short");
  return errors;
}

export function checkDiscussionSeed(seed: DiscussionSeed): string[] {
  const errors: string[] = [];
  if (!seed.course || seed.course.trim().length < 3) errors.push("Discussion missing course");
  if (!seed.professor?.name || !seed.professor?.text || seed.professor.text.trim().length < 40) {
    errors.push("Discussion professor prompt is too short");
  }
  if (!seed.students || seed.students.length !== 2) errors.push("Discussion needs two student posts");
  if (seed.students?.some((row) => !row?.name || !row?.text || row.text.trim().length < 20)) {
    errors.push("Discussion student posts are too short");
  }
  if (!seed.prompt || seed.prompt.trim().length < 20) errors.push("Discussion missing student prompt");
  return errors;
}
