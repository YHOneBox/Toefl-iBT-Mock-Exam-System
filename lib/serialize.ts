import type { ExamSession, Response, ScoreReport, TestForm } from "@prisma/client";
import { parseTiming } from "./timing-log";

export function serializeSession(
  session: ExamSession & {
    form: TestForm;
    responses: Response[];
    scoreReport?: ScoreReport | null;
  },
) {
  return {
    id: session.id,
    formId: session.formId,
    mode: session.mode,
    scope: JSON.parse(session.scopeJson),
    sourceSessionId: session.sourceSessionId,
    status: session.status,
    currentPointer: session.currentPointer,
    readingRoute: session.readingRoute,
    listeningRoute: session.listeningRoute,
    allowReadapt: session.allowReadapt,
    sectionStartedAt: session.sectionStartedAt?.toISOString() ?? null,
    sectionEndsAt: session.sectionEndsAt?.toISOString() ?? null,
    notepad: session.notepad,
    timing: parseTiming(safeParse((session as { timingJson?: string }).timingJson || "{}")),
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    topics: JSON.parse(session.form.topicTags) as string[],
    form: JSON.parse(session.form.payloadJson),
    responses: Object.fromEntries(
      session.responses.map((r) => [
        r.itemId,
        {
          value: safeParse(r.valueJson),
          recordingPath: r.recordingPath,
          transcript: r.transcript,
        },
      ]),
    ),
    scoreReport: session.scoreReport
      ? {
          raw: JSON.parse(session.scoreReport.rawJson),
          bands: JSON.parse(session.scoreReport.bandsJson),
          traits: JSON.parse(session.scoreReport.traitsJson),
          concordance: JSON.parse(session.scoreReport.concordanceJson),
          compositeFromSessionId: session.scoreReport.compositeFromSessionId,
        }
      : null,
  };
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
