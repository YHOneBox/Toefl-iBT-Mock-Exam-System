import { generateJson, type LlmJsonOptions } from "../llm";
import { defaultInsertPositions, splitSentences } from "../passage";
import { contentKey, isSeenKey } from "./content-key";
import type { Cefr, ExamDifficulty, McqQuestion, TestFormPayload } from "../types";
import {
  checkAcademicSeed,
  checkChooseSeed,
  checkCtwSeed,
  checkDailySeed,
  checkDiscussionSeed,
  checkEmailSeed,
  checkInterviewSeed,
  checkRepeatSeed,
  checkSentenceSeed,
  checkSpokenSeed,
} from "./item-checks";
import { loadGrownBank, seedKey } from "./grown-bank";
import type {
  AcademicSeed,
  ChooseSeed,
  CtwSeed,
  DailySeed,
  DiscussionSeed,
  EmailSeed,
  GrownBank,
  InterviewSeed,
  RepeatSeed,
  SentenceSeed,
  SpokenSeed,
} from "./seeds";
import { emptyGrownBank } from "./seeds";
import { retrieveItemContext } from "./vocab-pack";

const SYSTEM =
  "Create original enhanced TOEFL iBT practice items only. Never copy ETS or Official Guide wording. Return valid JSON.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const row = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  if (row.text || row.script || row.title || row.exchange) return [row];
  return [];
}

function asCefr(value: unknown, fallback: Cefr): Cefr {
  const raw = String(value || "");
  return raw === "A1" || raw === "A2" || raw === "B1" || raw === "B2" || raw === "C1" || raw === "C2"
    ? raw
    : fallback;
}

function asOptions(value: unknown): [string, string, string, string] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const options = value.slice(0, 4).map((item) => String(item || "").trim());
  if (options.some((item) => item.length < 2)) return null;
  return options as [string, string, string, string];
}

function defaultCefr(difficulty: ExamDifficulty): Cefr {
  if (difficulty === "easier") return "B1";
  if (difficulty === "harder") return "B2";
  return "B1";
}

function asQuestion(raw: unknown, fallback: Cefr, stimulus: string): McqQuestion | null {
  const row = asRecord(raw);
  const options = asOptions(row.options);
  const answerKey = Number(row.answerKey);
  const stem = String(row.stem || "").trim();
  if (!options || !Number.isInteger(answerKey) || answerKey < 0 || answerKey > 3 || stem.length < 8) return null;
  return {
    id: "",
    skill: String(row.skill || "factual"),
    cefr: asCefr(row.cefr, fallback),
    stem,
    options,
    answerKey,
    rationale: String(row.rationale || "Supported by the stimulus."),
  };
}

async function requestJson(
  user: string,
  signal?: AbortSignal,
  onWait?: LlmJsonOptions["onWait"],
  userId?: string,
): Promise<unknown> {
  return generateJson({
    system: SYSTEM,
    user,
    temperature: 0.85,
    signal,
    onWait,
    userId,
    timeoutMs: 55_000,
  });
}

async function withRetry<T>(
  buildUser: (lastError: string) => string,
  parse: (data: unknown) => T | null,
  check: (value: T) => string[],
  attempts = 2,
  signal?: AbortSignal,
  onWait?: LlmJsonOptions["onWait"],
  userId?: string,
): Promise<T | null> {
  let lastError = "";
  for (let i = 0; i < attempts; i += 1) {
    if (signal?.aborted) throw new Error("Preparation was stopped.");
    try {
      const data = await requestJson(buildUser(lastError), signal, onWait, userId);
      const parsed = parse(data);
      if (!parsed) {
        lastError = "JSON shape was incomplete";
        continue;
      }
      const errors = check(parsed);
      if (!errors.length) return parsed;
      lastError = errors.join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (signal?.aborted || /stopped/i.test(lastError)) throw err instanceof Error ? err : new Error(lastError);
      if (/GEMINI_API_KEY missing|401|403|invalid.*key|All Gemini models failed/i.test(lastError)) {
        throw err instanceof Error ? err : new Error(lastError);
      }
    }
  }
  return null;
}

function avoidFrom(form: TestFormPayload, bank: GrownBank): string[] {
  const titles = [
    ...form.topics,
    ...form.reading.module1.completeTheWords.map((set) => set.topic),
    ...[...bank.ctw, ...bank.daily, ...bank.academic, ...bank.talks, ...bank.conversations].map(
      (row) => ("title" in row ? String(row.title || row.topic) : row.topic),
    ),
  ];
  return [...new Set(titles.filter(Boolean))].slice(0, 18);
}

function parseCtwList(data: unknown): CtwSeed[] {
  return asList(data, ["passages", "items", "ctw"])
    .map((row) => {
      const item = asRecord(row);
      const text = String(item.text || "").trim();
      const topic = String(item.topic || "Academic topic").trim();
      return text ? { topic, text } : null;
    })
    .filter((row): row is CtwSeed => Boolean(row));
}

function parseDailyList(data: unknown, difficulty: ExamDifficulty): DailySeed[] {
  const cefr = defaultCefr(difficulty);
  return asList(data, ["items", "daily", "texts"])
    .map((row) => {
      const item = asRecord(row);
      const text = String(item.text || "").trim();
      const questions = asList(item.questions, []).map((q) => asQuestion(q, cefr, text)).filter((q): q is McqQuestion => Boolean(q));
      if (!text || questions.length < 2) return null;
      return {
        cefr: asCefr(item.cefr, cefr),
        topic: String(item.topic || "Campus life"),
        format: String(item.format || "notice"),
        title: String(item.title || "Campus notice"),
        text,
        questions: questions.slice(0, 3),
      };
    })
    .filter((row): row is DailySeed => Boolean(row));
}

function parseAcademic(data: unknown, difficulty: ExamDifficulty): AcademicSeed | null {
  const row = asRecord(Array.isArray(data) ? data[0] : asRecord(data).passage || asRecord(data).item || data);
  const text = String(row.text || "").trim();
  if (!text) return null;
  const cefr = asCefr(row.cefr, difficulty === "harder" ? "C1" : "B2");
  const sentences = splitSentences(text);
  const questions = asList(row.questions, []).map((raw) => {
    const item = asRecord(raw);
    const base = asQuestion(item, cefr, text);
    const insertSentence = String(item.insertSentence || "").trim();
    const select = item.passageAction === "select" || /select/i.test(String(item.skill || ""));
    if (select) {
      const answerKey = Number(item.answerKey);
      if (!Number.isInteger(answerKey) || answerKey < 0 || answerKey >= sentences.length) return null;
      return {
        id: "",
        skill: "select sentence",
        cefr,
        stem: String(item.stem || "Click the sentence that best answers the question."),
        options: ["", "", "", ""] as [string, string, string, string],
        answerKey,
        rationale: String(item.rationale || "That sentence carries the needed idea."),
        passageAction: "select" as const,
      };
    }
    if (insertSentence || item.passageAction === "insert" || /insert/i.test(String(item.skill || ""))) {
      const positions = Array.isArray(item.insertPositions)
        ? item.insertPositions.map((n) => Number(n)).filter((n) => Number.isInteger(n))
        : defaultInsertPositions(sentences.length);
      const answerKey = Number(item.answerKey);
      return {
        id: "",
        skill: "insert text",
        cefr,
        stem: String(item.stem || "Look at the four squares in the passage. Where would the sentence best fit?"),
        options: asOptions(item.options) || ["Square A", "Square B", "Square C", "Square D"],
        answerKey: Number.isInteger(answerKey) && answerKey >= 0 && answerKey <= 3 ? answerKey : 0,
        rationale: String(item.rationale || "The sentence continues the idea at that point."),
        passageAction: "insert" as const,
        insertSentence,
        insertPositions: positions.length === 4 ? positions : defaultInsertPositions(sentences.length),
      };
    }
    return base;
  });
  const usable = questions.filter((q): q is McqQuestion => Boolean(q)).slice(0, 5);
  if (usable.length !== 5) return null;
  if (!usable.some((q) => q.passageAction === "insert" && q.insertSentence)) return null;
  return {
    cefr,
    topic: String(row.topic || "Academic topic"),
    title: String(row.title || "Academic passage"),
    text,
    questions: usable,
  };
}

function parseChooseList(data: unknown, difficulty: ExamDifficulty): ChooseSeed[] {
  const cefr = defaultCefr(difficulty);
  return asList(data, ["items", "choose"])
    .map((row) => {
      const item = asRecord(row);
      const options = asOptions(item.options);
      const answerKey = Number(item.answerKey);
      const script = String(item.script || "").trim();
      if (!script || !options || !Number.isInteger(answerKey)) return null;
      return {
        cefr: asCefr(item.cefr, cefr),
        skill: String(item.skill || "social response"),
        script,
        options,
        answerKey,
        rationale: String(item.rationale || "This reply fits the spoken request."),
      };
    })
    .filter((row): row is ChooseSeed => Boolean(row));
}

function parseSpokenList(
  data: unknown,
  taskType: SpokenSeed["taskType"],
  difficulty: ExamDifficulty,
): SpokenSeed[] {
  const cefr = taskType === "listen_academic_talk" ? (difficulty === "easier" ? "B1" : "B2") : defaultCefr(difficulty);
  return asList(data, ["items", "sets", "talks", "conversations", "announcements"])
    .map((row) => {
      const item = asRecord(row);
      const speakersRaw = asList(item.speakers, []);
      const speakers = speakersRaw.length
        ? speakersRaw.map((speaker, i) => {
            const s = asRecord(speaker);
            const gender = s.gender === "male" ? "male" : "female";
            const accent = s.accent === "uk" || s.accent === "au" ? s.accent : "us";
            return {
              id: String(s.id || (i === 0 ? "a" : "b")),
              label: String(s.label || (gender === "male" ? "Man" : "Woman")),
              gender: gender as "male" | "female",
              accent: accent as "us" | "uk" | "au",
            };
          })
        : taskType === "listen_academic_talk"
          ? [{ id: "p", label: "Professor", gender: "female" as const, accent: "us" as const }]
          : [
              { id: "a", label: "Woman", gender: "female" as const, accent: "us" as const },
              { id: "b", label: "Man", gender: "male" as const, accent: "uk" as const },
            ];
      let script = asList(item.script, []).map((line) => {
        const l = asRecord(line);
        return { speakerId: String(l.speakerId || speakers[0]?.id || "a"), text: String(l.text || "").trim() };
      }).filter((line) => line.text);
      if (!script.length && item.text) {
        script = splitSentences(String(item.text)).map((text) => ({ speakerId: speakers[0].id, text }));
      }
      const stimulus = script.map((line) => line.text).join(" ");
      const need = taskType === "listen_academic_talk" ? 4 : 2;
      const questions = asList(item.questions, [])
        .map((q) => asQuestion(q, cefr, stimulus))
        .filter((q): q is McqQuestion => Boolean(q))
        .slice(0, need);
      if (script.length < 1 || questions.length !== need) return null;
      return {
        taskType,
        cefr: asCefr(item.cefr, cefr),
        topic: String(item.topic || (taskType === "listen_academic_talk" ? "Academic topic" : "Campus life")),
        title: String(item.title || "Listening set"),
        speakers,
        script,
        questions,
      };
    })
    .filter((row): row is SpokenSeed => Boolean(row));
}

function parseSentences(data: unknown, difficulty: ExamDifficulty): SentenceSeed[] {
  const cefr = defaultCefr(difficulty);
  return asList(data, ["items", "sentences"])
    .map((row) => {
      const item = asRecord(row);
      const answer = (Array.isArray(item.answer) ? item.answer : []).map((t) => String(t).trim()).filter(Boolean);
      const tokens = (Array.isArray(item.tokens) ? item.tokens : answer).map((t) => String(t).trim()).filter(Boolean);
      if (answer.length < 5) return null;
      return {
        cefr: asCefr(item.cefr, cefr),
        exchange: String(item.exchange || ""),
        tokens,
        answer,
        rationale: String(item.rationale || "This order is grammatical and fits the exchange."),
      };
    })
    .filter((row): row is SentenceSeed => Boolean(row));
}

function parseRepeat(data: unknown): RepeatSeed | null {
  const row = asRecord(asRecord(data).repeat || data);
  const sentences = asList(row.sentences, []).map((s) => String(s || "").trim()).filter(Boolean);
  if (sentences.length !== 7) return null;
  return {
    scenario: String(row.scenario || ""),
    setting: String(row.setting || "Campus"),
    sentences,
  };
}

function parseEmails(data: unknown, difficulty: ExamDifficulty): EmailSeed[] {
  const cefr = defaultCefr(difficulty);
  const items: EmailSeed[] = [];
  for (const row of asList(data, ["items", "emails"])) {
    const item = asRecord(row);
    const scenario = String(item.scenario || "").trim();
    const audience = String(item.audience || "").trim();
    const goal = String(item.goal || "").trim();
    if (!scenario || !audience || !goal) continue;
    const seed: EmailSeed = { cefr: asCefr(item.cefr, cefr), scenario, audience, goal };
    const sampleAnswer = String(item.sampleAnswer || "").trim();
    if (sampleAnswer) seed.sampleAnswer = sampleAnswer;
    items.push(seed);
  }
  return items;
}

function parseDiscussions(data: unknown, difficulty: ExamDifficulty): DiscussionSeed[] {
  const cefr = defaultCefr(difficulty);
  return asList(data, ["items", "discussions"])
    .map((row) => {
      const item = asRecord(row);
      const professorRaw = asRecord(item.professor);
      const students = asList(item.students, [])
        .map((student) => {
          const s = asRecord(student);
          return { name: String(s.name || "").trim(), text: String(s.text || "").trim() };
        })
        .filter((student) => student.name && student.text)
        .slice(0, 2);
      const prompt = String(item.prompt || "").trim();
      const course = String(item.course || "").trim();
      if (!course || !professorRaw.text || students.length !== 2 || !prompt) return null;
      return {
        cefr: asCefr(item.cefr, cefr),
        course,
        professor: {
          name: String(professorRaw.name || "Professor"),
          text: String(professorRaw.text || "").trim(),
        },
        students,
        prompt,
      };
    })
    .filter((row): row is DiscussionSeed => Boolean(row));
}

function parseInterview(data: unknown): InterviewSeed | null {
  const row = asRecord(asRecord(data).interview || data);
  const questions = asList(row.questions, []).map((s) => String(s || "").trim()).filter(Boolean);
  if (questions.length !== 4) return null;
  return {
    scenario: String(row.scenario || ""),
    interviewer: String(row.interviewer || "Dr. Lee"),
    questions,
  };
}

function retryNote(lastError: string): string {
  return lastError ? `\nThe previous attempt failed validation: ${lastError}. Fix those problems.` : "";
}

const FOCUS_BATCHES: Record<string, string[]> = {
  sentences: ["sentences"],
  email: ["writing-prompts"],
  discussion: ["writing-prompts"],
  repeats: ["speaking"],
  interviews: ["speaking"],
  ctw: ["reading"],
  daily: ["daily"],
  academic: ["academic"],
  choose: ["listen-choose"],
  conversations: ["listening-sets"],
  announcements: ["listening-sets"],
  talks: ["listening-sets"],
};

const UNIQUENESS_CYCLE = [
  "daily",
  "sentences",
  "writing-prompts",
  "listen-choose",
  "listening-sets",
  "reading",
  "academic",
  "speaking",
];

function batchIdsForFocus(focus?: string, round = 0): Set<string> | null {
  if (!focus) return null;
  if (focus === "uniqueness" || focus === "valid-paper") {
    return new Set([UNIQUENESS_CYCLE[round % UNIQUENESS_CYCLE.length]]);
  }
  const mapped = FOCUS_BATCHES[focus];
  return mapped ? new Set(mapped) : null;
}

export async function createFreshItems(
  difficulty: ExamDifficulty,
  form: TestFormPayload,
  extraAvoid: string[] = [],
  opts?: {
    scale?: number;
    onBatch?: (label: string) => void;
    focus?: string;
    round?: number;
    signal?: AbortSignal;
    seen?: Set<string>;
    userId?: string;
    onWait?: LlmJsonOptions["onWait"];
  },
): Promise<{ bank: GrownBank; added: number; focus?: string }> {
  const existing = loadGrownBank();
  const avoid = [...new Set([...avoidFrom(form, existing), ...extraAvoid])];
  const bank = emptyGrownBank();
  const scale = opts?.scale === 2 ? 2 : 1;
  const signal = opts?.signal;
  const ctwN = scale === 2 ? 6 : 4;
  const dailyN = scale === 2 ? 8 : 6;
  const chooseN = scale === 2 ? 16 : 10;
  const talkN = scale === 2 ? 3 : 2;
  const convN = scale === 2 ? 6 : 4;
  const annN = scale === 2 ? 3 : 2;
  const sentN = scale === 2 ? 14 : 10;
  const emailN = scale === 2 ? 4 : 3;
  const discN = scale === 2 ? 3 : 2;
  const retry = 2;
  const onWait = opts?.onWait;

  type Batch = { id: string; label: string; run: () => Promise<void> };
  const batches: Batch[] = [
    {
      id: "reading",
      label: "reading passages",
      run: async () => {
        const items = await withRetry(
          (err) =>
            `${retrieveItemContext("ctw", difficulty, avoid)}
Write ${ctwN} original Complete the Words passages.
Each passage: 70-100 words, at least 3 sentences, first sentence complete, 10 later words that can lose their second half.
JSON: {"passages":[{"topic":"","text":""}]}
${retryNote(err)}`,
          (data) => parseCtwList(data),
          (items) => (items.some((item) => !checkCtwSeed(item).length) ? [] : ["No valid CTW passages"]),
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (items) bank.ctw.push(...items.filter((item) => !checkCtwSeed(item).length));
      },
    },
    {
      id: "daily",
      label: "daily-life texts",
      run: async () => {
        const items = await withRetry(
          (err) =>
            `${retrieveItemContext("daily", difficulty, avoid)}
Write ${dailyN} original Read in Daily Life texts (15-150 words). Include at least two texts with 3 questions; the rest may have 2.
JSON: {"items":[{"cefr":"B1","topic":"Campus life","format":"email","title":"","text":"","questions":[{"stem":"","options":["","","",""],"answerKey":0,"rationale":"","skill":"factual"}]}]}
${retryNote(err)}`,
          (data) => parseDailyList(data, difficulty),
          (items) => (items.some((item) => !checkDailySeed(item).length) ? [] : ["No valid daily texts"]),
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (items) bank.daily.push(...items.filter((item) => !checkDailySeed(item).length));
      },
    },
    {
      id: "academic",
      label: "academic passage",
      run: async () => {
        const item = await withRetry(
          (err) =>
            `${retrieveItemContext("academic", difficulty, avoid)}
Write 1 original academic reading passage of 180-220 words and exactly 5 questions.
Question mix: factual, vocabulary, inference, insert-text, and either rhetorical purpose or select-the-sentence.
The insert-text question MUST include insertSentence and insertPositions (4 sentence indexes after which a black square appears) and answerKey 0-3.
A select-the-sentence question uses passageAction "select" and answerKey = sentence index in the passage.
JSON: {"title":"","topic":"","cefr":"B2","text":"","questions":[{"stem":"","options":["","","",""],"answerKey":0,"rationale":"","skill":"factual","passageAction":"","insertSentence":"","insertPositions":[0,2,4,6]}]}
${retryNote(err)}`,
          (data) => parseAcademic(data, difficulty),
          (item) => (item ? checkAcademicSeed(item) : ["No academic passage"]),
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (item) bank.academic.push(item);
      },
    },
    {
      id: "listen-choose",
      label: "listen-and-choose items",
      run: async () => {
        const items = await withRetry(
          (err) =>
            `${retrieveItemContext("choose", difficulty, avoid)}
Write ${chooseN} original Listen and Choose a Response items. Script is a spoken campus question or statement (8-30 words), never the printed stem.
JSON: {"items":[{"cefr":"B1","skill":"social response","script":"","options":["","","",""],"answerKey":0,"rationale":""}]}
${retryNote(err)}`,
          (data) => parseChooseList(data, difficulty),
          (items) => (items.some((item) => !checkChooseSeed(item).length) ? [] : ["No valid listen-choose items"]),
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (items) bank.choose.push(...items.filter((item) => !checkChooseSeed(item).length));
      },
    },
    {
      id: "listening-sets",
      label: "listening sets",
      run: async () => {
        const bundle = await withRetry(
          (err) =>
            `${retrieveItemContext("talk", difficulty, avoid)}
Write original listening sets:
- ${talkN} academic talks, 175-250 words, 4 questions each, professor only
- ${convN} campus conversations, 35-100 words, two speakers, 2 questions each
- ${annN} campus announcements, 40-85 words, 2 questions each
JSON: {"talks":[{"title":"","topic":"","cefr":"B2","speakers":[{"id":"p","label":"Professor","gender":"female","accent":"us"}],"script":[{"speakerId":"p","text":""}],"questions":[{"stem":"","options":["","","",""],"answerKey":0,"rationale":"","skill":"main idea"}]}],"conversations":[{"title":"","topic":"Campus life","cefr":"B1","speakers":[{"id":"a","label":"Woman","gender":"female","accent":"us"},{"id":"b","label":"Man","gender":"male","accent":"uk"}],"script":[{"speakerId":"a","text":""}],"questions":[]}],"announcements":[{"title":"","topic":"Campus life","cefr":"B1","speakers":[{"id":"n","label":"Announcer","gender":"female","accent":"au"}],"script":[{"speakerId":"n","text":""}],"questions":[]}]}
${retryNote(err)}`,
          (data) => {
            const row = asRecord(data);
            return {
              talks: parseSpokenList(row.talks || row, "listen_academic_talk", difficulty),
              conversations: parseSpokenList(row.conversations, "listen_conversation", difficulty),
              announcements: parseSpokenList(row.announcements, "listen_announcement", difficulty),
            };
          },
          (bundle) => {
            const any =
              bundle.talks.some((item) => !checkSpokenSeed(item).length) ||
              bundle.conversations.some((item) => !checkSpokenSeed(item).length) ||
              bundle.announcements.some((item) => !checkSpokenSeed(item).length);
            return any ? [] : ["No valid spoken sets"];
          },
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (!bundle) return;
        bank.talks.push(...bundle.talks.filter((item) => !checkSpokenSeed(item).length));
        bank.conversations.push(...bundle.conversations.filter((item) => !checkSpokenSeed(item).length));
        bank.announcements.push(...bundle.announcements.filter((item) => !checkSpokenSeed(item).length));
      },
    },
    {
      id: "sentences",
      label: "build-a-sentence items",
      run: async () => {
        const items = await withRetry(
          (err) =>
            `${retrieveItemContext("sentence", difficulty, avoid)}
Write ${sentN} original Build a Sentence items. Each has a short A/B campus exchange plus tokens that exactly match the answer words.
JSON: {"items":[{"cefr":"B1","exchange":"A: ...\\nB:","tokens":[],"answer":[],"rationale":""}]}
${retryNote(err)}`,
          (data) => parseSentences(data, difficulty),
          (rows) => (rows.some((item) => !checkSentenceSeed(item).length) ? [] : ["No valid sentence items"]),
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (items) bank.sentences.push(...items.filter((item) => !checkSentenceSeed(item).length));
      },
    },
    {
      id: "writing-prompts",
      label: "email and discussion prompts",
      run: async () => {
        const bundle = await withRetry(
          (err) =>
            `${retrieveItemContext("email", difficulty, avoid)}
Write original unused writing prompts for enhanced TOEFL iBT:
- ${emailN} Write an Email scenarios (campus situation, audience, goal, and a 90-130 word sample student email)
- ${discN} Academic Discussion threads (course name, professor question, two student posts, and a reply prompt)
JSON: {"emails":[{"cefr":"B1","scenario":"","audience":"","goal":"","sampleAnswer":""}],"discussions":[{"cefr":"B1","course":"","professor":{"name":"","text":""},"students":[{"name":"","text":""},{"name":"","text":""}],"prompt":""}]}
${retryNote(err)}`,
          (data) => {
            const row = asRecord(data);
            return {
              emails: parseEmails(row.emails || row.items || data, difficulty),
              discussions: parseDiscussions(row.discussions || data, difficulty),
            };
          },
          (value) => {
            const any =
              value.emails.some((item) => !checkEmailSeed(item).length) ||
              value.discussions.some((item) => !checkDiscussionSeed(item).length);
            return any ? [] : ["No valid email or discussion prompts"];
          },
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (!bundle) return;
        bank.emails.push(...bundle.emails.filter((item) => !checkEmailSeed(item).length));
        bank.discussions.push(...bundle.discussions.filter((item) => !checkDiscussionSeed(item).length));
      },
    },
    {
      id: "speaking",
      label: "speaking items",
      run: async () => {
        const bundle = await withRetry(
          (err) =>
            `${retrieveItemContext("speaking", difficulty, avoid)}
Write original speaking seeds:
- 1 Listen and Repeat scenario with exactly 7 sentences that get longer
- 1 interview: scenario, interviewer name, 4 questions (fact, reaction, opinion, policy)
JSON: {"repeat":{"scenario":"","setting":"","sentences":["","","","","","",""]},"interview":{"scenario":"","interviewer":"","questions":["","","",""]}}
${retryNote(err)}`,
          (data) => {
            const row = asRecord(data);
            return {
              repeat: parseRepeat(row.repeat || data),
              interview: parseInterview(row.interview || data),
            };
          },
          (value) => {
            const any =
              (value.repeat ? !checkRepeatSeed(value.repeat).length : false) ||
              (value.interview ? !checkInterviewSeed(value.interview).length : false);
            return any ? [] : ["No valid speaking seeds"];
          },
          retry,
          signal,
          onWait,
          opts?.userId,
        );
        if (!bundle) return;
        if (bundle.repeat && !checkRepeatSeed(bundle.repeat).length) bank.repeats.push(bundle.repeat);
        if (bundle.interview && !checkInterviewSeed(bundle.interview).length) bank.interviews.push(bundle.interview);
      },
    },
  ];

  const wanted = batchIdsForFocus(opts?.focus, opts?.round || 0);
  const selected = wanted?.size ? batches.filter((batch) => wanted.has(batch.id)) : batches;

  for (const batch of selected) {
    if (signal?.aborted) break;
    opts?.onBatch?.(batch.label);
    try {
      await batch.run();
    } catch (err) {
      if (signal?.aborted) break;
      const message = err instanceof Error ? err.message : String(err);
      if (/stopped/i.test(message)) break;
      if (/GEMINI_API_KEY missing|401|403|invalid.*key|All Gemini models failed/i.test(message)) throw err;
    }
  }
  dropSeenFromBank(bank, opts?.seen);
  const added = Object.values(bank).reduce((n, value) => n + (Array.isArray(value) ? value.length : 0), 0);
  return { bank, added, focus: opts?.focus };
}

function seedQuestionStems(item: unknown): string[] {
  const row = item as { questions?: Array<{ stem?: string }> };
  return (row.questions || []).map((question) => contentKey(question.stem || "")).filter(Boolean);
}

function dropSeenFromBank(bank: GrownBank, seen?: Set<string>) {
  const used = new Set<string>();
  const keep = <K extends keyof Omit<GrownBank, "version">>(kind: K) => {
    const items = bank[kind] as unknown[];
    bank[kind] = items.filter((item) => {
      const key = seedKey(kind, item);
      if (!key || used.has(`${kind}:${key}`)) return false;
      if (seen && isSeenKey(seen, key)) return false;
      if (seen && seedQuestionStems(item).some((stem) => isSeenKey(seen, stem))) return false;
      used.add(`${kind}:${key}`);
      return true;
    }) as GrownBank[K];
  };
  keep("ctw");
  keep("daily");
  keep("academic");
  keep("choose");
  keep("conversations");
  keep("announcements");
  keep("talks");
  keep("sentences");
  keep("emails");
  keep("discussions");
  keep("repeats");
  keep("interviews");
}
