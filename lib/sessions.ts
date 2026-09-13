import { prisma } from "./db";
import { firstPointer, nextPointer } from "./flow";
import { parseForm } from "./form";
import { attachFormAudio } from "./generation/audio-fill";
import { generateFormPayload, type GenerateProgress } from "./generation";
import { fingerprintsFromForm, labelsFromForm, rememberSeen } from "./generation/history";
import { routeFromAccuracy, scoreListeningModule, scoreReadingModule } from "./adaptive";
import { parseScope } from "./scope";
import { durationForPointer } from "./timing";
import type { ExamDifficulty, Pointer, RouteLevel, ScopePart, SessionMode } from "./types";

export async function createPreparedForm(
  userId: string,
  difficulty: ExamDifficulty = "standard",
  onProgress?: GenerateProgress,
) {
  const payload = await generateFormPayload(difficulty, userId, onProgress);
  onProgress?.({ progress: 76, stage: "Saving the unused paper" });
  const form = await prisma.testForm.create({
    data: {
      topicTags: JSON.stringify(payload.topics),
      payloadJson: JSON.stringify(payload),
      difficulty,
      userId,
    },
  });
  try {
    const withAudio = await attachFormAudio(form.id, payload, (done, total) => {
      const ratio = total ? done / total : 1;
      onProgress?.({
        progress: 78 + Math.round(ratio * 18),
        stage: `Creating audio ${done} / ${total}`,
      });
    });
    await prisma.testForm.update({
      where: { id: form.id },
      data: { payloadJson: JSON.stringify(withAudio) },
    });
    rememberSeen(userId, fingerprintsFromForm(withAudio), labelsFromForm(withAudio));
    return form;
  } catch (err) {
    await prisma.testForm.delete({ where: { id: form.id } }).catch(() => undefined);
    throw err;
  }
}

export async function createNewTest(userId: string, difficulty: ExamDifficulty = "standard") {
  const form = await createPreparedForm(userId, difficulty);
  return createSession({
    formId: form.id,
    mode: "new",
    scope: ["full"],
    userId,
  });
}

export async function createSession(opts: {
  formId: string;
  mode: SessionMode;
  scope: ScopePart[];
  sourceSessionId?: string;
  allowReadapt?: boolean;
  userId: string;
}) {
  const formRow = await prisma.testForm.findUnique({ where: { id: opts.formId } });
  if (!formRow || formRow.userId !== opts.userId) throw new Error("Form not found");
  const form = parseForm(formRow.payloadJson);
  const source = opts.sourceSessionId
    ? await prisma.examSession.findUnique({ where: { id: opts.sourceSessionId } })
    : null;
  if (source && source.userId !== opts.userId) throw new Error("Source session not found");
  const pointer = firstPointer(opts.scope, form);
  const now = new Date();
  const timed = durationForPointer(pointer);
  return prisma.examSession.create({
    data: {
      formId: opts.formId,
      userId: opts.userId,
      mode: opts.mode,
      scopeJson: JSON.stringify(opts.scope),
      sourceSessionId: opts.sourceSessionId,
      status: "checkin",
      currentPointer: pointer,
      allowReadapt: Boolean(opts.allowReadapt),
      readingRoute: opts.allowReadapt ? null : source?.readingRoute,
      listeningRoute: opts.allowReadapt ? null : source?.listeningRoute,
      sectionStartedAt: timed ? now : null,
      sectionEndsAt: timed ? new Date(now.getTime() + timed) : null,
    },
  });
}

export class SessionLockedError extends Error {
  constructor() {
    super("This test is already submitted and cannot be changed");
  }
}

export function isSessionLocked(session: { status: string; currentPointer: string }) {
  return (
    session.status === "completed" ||
    session.status === "scoring" ||
    session.currentPointer === "completed" ||
    session.currentPointer === "scoring"
  );
}

export async function requireOpenSession(sessionId: string) {
  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");
  if (isSessionLocked(session)) throw new SessionLockedError();
  return session;
}

export async function saveResponse(
  sessionId: string,
  itemId: string,
  value: unknown,
  extra?: { recordingPath?: string; transcript?: string },
) {
  await requireOpenSession(sessionId);
  return prisma.response.upsert({
    where: { sessionId_itemId: { sessionId, itemId } },
    create: {
      sessionId,
      itemId,
      valueJson: JSON.stringify(value),
      recordingPath: extra?.recordingPath,
      transcript: extra?.transcript,
    },
    update: {
      valueJson: JSON.stringify(value),
      recordingPath: extra?.recordingPath,
      transcript: extra?.transcript,
    },
  });
}

export async function advanceSession(sessionId: string) {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { form: true, responses: true },
  });
  if (!session) throw new Error("Session not found");
  if (isSessionLocked(session)) throw new SessionLockedError();
  const form = parseForm(session.form.payloadJson);
  const scope = parseScope(session.scopeJson);
  const current = session.currentPointer as Pointer;
  const answers: Record<string, unknown> = {};
  for (const row of session.responses) {
    try {
      answers[row.itemId] = JSON.parse(row.valueJson);
    } catch {
      answers[row.itemId] = row.valueJson;
    }
  }

  let readingRoute = session.readingRoute as RouteLevel | null;
  let listeningRoute = session.listeningRoute as RouteLevel | null;

  if (current === "reading:review-m1" || current === "reading:m1") {
    if (!readingRoute || session.allowReadapt) {
      const scored = scoreReadingModule(form, "m1", scope, answers);
      readingRoute = routeFromAccuracy(scored.correct, scored.possible);
    }
  }
  if (current === "listening:m1") {
    if (!listeningRoute || session.allowReadapt) {
      const scored = scoreListeningModule(form, "m1", scope, answers);
      listeningRoute = routeFromAccuracy(scored.correct, scored.possible);
    }
  }

  const next = nextPointer(current, scope, form);
  const now = new Date();
  const timed = durationForPointer(next, listeningRoute);
  const keepClock = next.startsWith("reading:review");
  const startsClock = timed !== null && !keepClock;

  return prisma.examSession.update({
    where: { id: sessionId },
    data: {
      currentPointer: next,
      status: next === "scoring" || next === "completed" ? "scoring" : "in_progress",
      readingRoute,
      listeningRoute,
      sectionStartedAt: startsClock ? now : keepClock ? session.sectionStartedAt : null,
      sectionEndsAt:
        startsClock && timed ? new Date(now.getTime() + timed) : keepClock ? session.sectionEndsAt : null,
    },
  });
}

export async function discardSession(sessionId: string) {
  await requireOpenSession(sessionId);
  return prisma.examSession.update({
    where: { id: sessionId },
    data: { status: "discarded" },
  });
}

export async function updateNotepad(sessionId: string, notepad: string) {
  await requireOpenSession(sessionId);
  return prisma.examSession.update({
    where: { id: sessionId },
    data: { notepad },
  });
}

export async function updateTiming(sessionId: string, timing: unknown) {
  await requireOpenSession(sessionId);
  return prisma.examSession.update({
    where: { id: sessionId },
    data: { timingJson: JSON.stringify(timing ?? {}) },
  });
}
