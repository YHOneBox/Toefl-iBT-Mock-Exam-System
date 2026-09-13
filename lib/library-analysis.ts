import { scoreListeningModule, scoreReadingModule } from "./adaptive";
import { flattenListeningItems, flattenReadingSets, listeningBundle, readingBundle, taskLabel } from "./form";
import { parseScope, sectionEnabled, taskEnabled } from "./scope";
import { matchGap, matchSentence, normalizeMcq, normalizeWords } from "./scoring";
import { officialLimit, parseTiming, partMs } from "./timing-log";
import type { RawScores, RouteLevel, ScopePart, TaskType, TestFormPayload } from "./types";

export type TaskSlice = {
  id: string;
  label: string;
  correct?: number;
  possible?: number;
  score?: number;
  max?: number;
  detail?: string;
};

export type ModuleSlice = {
  section: "reading" | "listening";
  label: string;
  correct: number;
  possible: number;
};

export type TimingSlice = {
  label: string;
  ms: number;
  limitMs: number | null;
};

export type WritingNote = {
  score: number;
  improve: string;
  issues: string[];
  reason: string;
};

export type AttemptAnalysis = {
  bands: Record<string, number> | null;
  raw: RawScores | null;
  classic30: Record<string, number | undefined> | null;
  cefr: Record<string, string | null> | null;
  overall120: number | null;
  projected120: number | null;
  projectedOverall: number | null;
  readingRoute: string | null;
  listeningRoute: string | null;
  modules: ModuleSlice[];
  tasks: TaskSlice[];
  timing: TimingSlice[];
  totalMs: number;
  writing: { email?: WritingNote; discussion?: WritingNote };
  speaking: {
    repeats: Array<{ score: number; wer: number | null }>;
    interviews: Array<{ score: number; improve?: string }>;
    avgWer: number | null;
  };
  insights: string[];
};

type ScoreBundle = {
  rawJson: string;
  bandsJson: string;
  traitsJson: string;
  concordanceJson: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function bump(map: Record<string, { correct: number; possible: number }>, key: string, ok: boolean) {
  if (!map[key]) map[key] = { correct: 0, possible: 0 };
  map[key].possible += 1;
  if (ok) map[key].correct += 1;
}

function pct(correct: number, possible: number) {
  if (!possible) return null;
  return Math.round((100 * correct) / possible);
}

function writingNote(raw: unknown): WritingNote | undefined {
  const row = asRecord(raw);
  if (row.score == null) return undefined;
  return {
    score: Number(row.score) || 0,
    improve: String(row.how_to_improve || ""),
    issues: Array.isArray(row.formatIssues) ? row.formatIssues.map((item) => String(item)) : [],
    reason: String(row.reason || ""),
  };
}

function readingTaskCounts(
  form: TestFormPayload,
  route: RouteLevel,
  scope: ScopePart[],
  answers: Record<string, unknown>,
) {
  const buckets: Record<string, { correct: number; possible: number }> = {};
  for (const module of ["m1", route] as const) {
    for (const set of flattenReadingSets(readingBundle(form, module), scope)) {
      if (set.taskType === "complete_the_words") {
        const words = normalizeWords(answers[set.id] ?? answers);
        for (const token of set.tokens) {
          if (!token.isGap || !token.itemId) continue;
          const given = String(words[token.itemId] ?? "");
          bump(buckets, set.taskType, matchGap(given, token.answer || "", token.aliases));
        }
      } else {
        for (const q of set.questions) {
          bump(buckets, set.taskType, normalizeMcq(answers[q.id]) === q.answerKey);
        }
      }
    }
  }
  return buckets;
}

function listeningTaskCounts(
  form: TestFormPayload,
  route: RouteLevel,
  scope: ScopePart[],
  answers: Record<string, unknown>,
) {
  const buckets: Record<string, { correct: number; possible: number }> = {};
  for (const module of ["m1", route] as const) {
    for (const entry of flattenListeningItems(listeningBundle(form, module), scope)) {
      const task = entry.kind === "choose" ? entry.item.taskType : entry.item.taskType;
      if (entry.kind === "choose") {
        bump(buckets, task, normalizeMcq(answers[entry.item.id]) === entry.item.answerKey);
      } else {
        for (const q of entry.item.questions) {
          bump(buckets, task, normalizeMcq(answers[q.id]) === q.answerKey);
        }
      }
    }
  }
  return buckets;
}

function toTaskSlices(buckets: Record<string, { correct: number; possible: number }>): TaskSlice[] {
  return Object.entries(buckets).map(([id, row]) => ({
    id,
    label: taskLabel(id as TaskType),
    correct: row.correct,
    possible: row.possible,
    detail: `${row.correct}/${row.possible} · ${pct(row.correct, row.possible)}%`,
  }));
}

export function buildAttemptAnalysis(input: {
  formJson: string;
  scopeJson: string;
  answers: Record<string, unknown>;
  readingRoute: string | null;
  listeningRoute: string | null;
  timingJson: string | null;
  score: ScoreBundle | null;
}): AttemptAnalysis | null {
  if (!input.score) return null;
  const form = JSON.parse(input.formJson) as TestFormPayload;
  const scope = parseScope(input.scopeJson);
  const bands = JSON.parse(input.score.bandsJson) as Record<string, number>;
  const raw = JSON.parse(input.score.rawJson) as RawScores;
  const concordance = JSON.parse(input.score.concordanceJson) as {
    overall120?: number | null;
    projected120?: number | null;
    classic30?: Record<string, number | undefined>;
    cefr?: Record<string, string | null>;
  };
  const traitsBundle = asRecord(JSON.parse(input.score.traitsJson));
  const traits = asRecord(traitsBundle.traits);
  const itemResults = asRecord(traitsBundle.itemResults);
  const readingRoute = (input.readingRoute as RouteLevel) || raw.reading?.route || "lower";
  const listeningRoute = (input.listeningRoute as RouteLevel) || raw.listening?.route || "lower";
  let timingRaw: unknown = null;
  try {
    timingRaw = input.timingJson ? JSON.parse(input.timingJson) : null;
  } catch {
    timingRaw = null;
  }
  const timing = parseTiming(timingRaw);

  const modules: ModuleSlice[] = [];
  const tasks: TaskSlice[] = [];

  if (sectionEnabled(scope, "reading") && raw.reading) {
    const m1 = scoreReadingModule(form, "m1", scope, input.answers);
    const m2 = scoreReadingModule(form, readingRoute, scope, input.answers);
    modules.push({ section: "reading", label: "Reading Module 1", ...m1 });
    modules.push({ section: "reading", label: `Reading Module 2 (${readingRoute})`, ...m2 });
    tasks.push(...toTaskSlices(readingTaskCounts(form, readingRoute, scope, input.answers)));
  }
  if (sectionEnabled(scope, "listening") && raw.listening) {
    const m1 = scoreListeningModule(form, "m1", scope, input.answers);
    const m2 = scoreListeningModule(form, listeningRoute, scope, input.answers);
    modules.push({ section: "listening", label: "Listening Module 1", ...m1 });
    modules.push({ section: "listening", label: `Listening Module 2 (${listeningRoute})`, ...m2 });
    tasks.push(...toTaskSlices(listeningTaskCounts(form, listeningRoute, scope, input.answers)));
  }

  if (sectionEnabled(scope, "writing") && raw.writing) {
    if (taskEnabled(scope, "writing", "build_sentence")) {
      let correct = 0;
      for (const item of form.writing.sentences) {
        const stored = asRecord(itemResults[item.id]);
        const given = Array.isArray(input.answers[item.id]) ? (input.answers[item.id] as string[]) : [];
        const ok = typeof stored.correct === "boolean" ? stored.correct : matchSentence(given, item.answer, item.alternates);
        if (ok) correct += 1;
      }
      tasks.push({
        id: "build_sentence",
        label: taskLabel("build_sentence"),
        correct,
        possible: form.writing.sentences.length,
        detail: `${correct}/${form.writing.sentences.length} · ${pct(correct, form.writing.sentences.length)}%`,
      });
    }
    if (raw.writing.email != null) {
      tasks.push({
        id: "write_email",
        label: taskLabel("write_email"),
        score: raw.writing.email,
        max: 5,
        detail: `${raw.writing.email}/5`,
      });
    }
    if (raw.writing.discussion != null) {
      tasks.push({
        id: "write_discussion",
        label: taskLabel("write_discussion"),
        score: raw.writing.discussion,
        max: 5,
        detail: `${raw.writing.discussion}/5`,
      });
    }
  }

  const repeats: Array<{ score: number; wer: number | null }> = [];
  const interviews: Array<{ score: number; improve?: string }> = [];
  if (sectionEnabled(scope, "speaking") && raw.speaking) {
    if (taskEnabled(scope, "speaking", "listen_repeat")) {
      for (const item of form.speaking.listenRepeat.items) {
        const stored = asRecord(itemResults[item.id]);
        repeats.push({
          score: Number(stored.score) || 0,
          wer: typeof stored.wer === "number" ? stored.wer : null,
        });
      }
      const possible = repeats.length * 5;
      tasks.push({
        id: "listen_repeat",
        label: taskLabel("listen_repeat"),
        score: raw.speaking.repeat,
        max: possible || 35,
        detail: `${raw.speaking.repeat}/${possible || 35}`,
      });
    }
    if (taskEnabled(scope, "speaking", "take_interview")) {
      for (const item of form.speaking.interview.items) {
        const stored = asRecord(itemResults[item.id]);
        interviews.push({
          score: Number(stored.score) || 0,
          improve: stored.how_to_improve ? String(stored.how_to_improve) : undefined,
        });
      }
      const possible = interviews.length * 5;
      tasks.push({
        id: "take_interview",
        label: taskLabel("take_interview"),
        score: raw.speaking.interview,
        max: possible || 20,
        detail: `${raw.speaking.interview}/${possible || 20}`,
      });
    }
  }

  const timingRows: TimingSlice[] = [
    { label: "Reading Module 1", ms: partMs(timing, ["reading:m1"]), limitMs: officialLimit("reading:m1") },
    { label: "Reading Module 2", ms: partMs(timing, ["reading:m2"]), limitMs: officialLimit("reading:m2") },
    { label: "Listening Module 1", ms: partMs(timing, ["listening:m1"]), limitMs: officialLimit("listening:m1") },
    {
      label: "Listening Module 2",
      ms: partMs(timing, ["listening:m2"]),
      limitMs: officialLimit("listening:m2", listeningRoute),
    },
    { label: "Build a Sentence", ms: partMs(timing, ["writing:sentences"]), limitMs: officialLimit("writing:sentences") },
    { label: "Email", ms: partMs(timing, ["writing:email"]), limitMs: officialLimit("writing:email") },
    { label: "Discussion", ms: partMs(timing, ["writing:discussion"]), limitMs: officialLimit("writing:discussion") },
    { label: "Listen and Repeat", ms: partMs(timing, ["speaking:repeat"]), limitMs: null },
    { label: "Interview", ms: partMs(timing, ["speaking:interview"]), limitMs: null },
  ].filter((row) => row.ms > 0);

  const werValues = repeats.map((row) => row.wer).filter((value): value is number => value != null);
  const avgWer = werValues.length ? werValues.reduce((a, b) => a + b, 0) / werValues.length : null;
  const writing = {
    email: writingNote(traits.email),
    discussion: writingNote(traits.discussion),
  };

  const insights: string[] = [];
  const sectionBands = (
    [
      ["reading", bands.reading],
      ["listening", bands.listening],
      ["writing", bands.writing],
      ["speaking", bands.speaking],
    ] as const
  ).filter((row): row is [(typeof row)[0], number] => typeof row[1] === "number");
  if (sectionBands.length) {
    const ranked = [...sectionBands].sort((a, b) => b[1] - a[1]);
    const [bestName, bestBand] = ranked[0];
    const [weakName, weakBand] = ranked[ranked.length - 1];
    insights.push(`Strongest section: ${bestName} (${bestBand.toFixed(1)}).`);
    if (weakName !== bestName) insights.push(`Weakest section: ${weakName} (${weakBand.toFixed(1)}).`);
  }
  if (raw.reading?.route) {
    insights.push(
      raw.reading.route === "upper"
        ? "Reading Module 1 routed you to the harder Module 2."
        : "Reading Module 1 routed you to the easier Module 2.",
    );
  }
  if (raw.listening?.route) {
    insights.push(
      raw.listening.route === "upper"
        ? "Listening Module 1 routed you to the harder Module 2."
        : "Listening Module 1 routed you to the easier Module 2.",
    );
  }
  const weakTasks = tasks
    .filter((task) => task.possible && task.possible >= 3 && (task.correct || 0) / task.possible < 0.6)
    .sort((a, b) => (a.correct || 0) / (a.possible || 1) - (b.correct || 0) / (b.possible || 1));
  if (weakTasks[0]) {
    insights.push(`${weakTasks[0].label} was the weakest objective set (${weakTasks[0].detail}).`);
  }
  if (writing.email?.issues.length) {
    insights.push(`Email format: ${writing.email.issues[0]}`);
  }
  if (writing.discussion?.issues.length) {
    insights.push(`Discussion format: ${writing.discussion.issues[0]}`);
  }
  if (avgWer != null && avgWer >= 0.28) {
    insights.push(`Listen and Repeat word-error rate averaged ${Math.round(avgWer * 100)}%.`);
  }
  for (const row of timingRows) {
    if (row.limitMs && row.ms > row.limitMs) {
      insights.push(`${row.label} ran past the official clock.`);
    }
  }
  if (bands.projectedOverall != null) {
    insights.push(`Redo projected overall (other sections kept from the source attempt): ${bands.projectedOverall.toFixed(1)}.`);
  }

  return {
    bands,
    raw,
    classic30: concordance.classic30 || null,
    cefr: concordance.cefr || null,
    overall120: concordance.overall120 ?? null,
    projected120: concordance.projected120 ?? null,
    projectedOverall: bands.projectedOverall ?? null,
    readingRoute,
    listeningRoute,
    modules,
    tasks,
    timing: timingRows,
    totalMs: timingRows.reduce((sum, row) => sum + row.ms, 0),
    writing,
    speaking: { repeats, interviews, avgWer },
    insights,
  };
}
