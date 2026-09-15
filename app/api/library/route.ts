import { NextResponse } from "next/server";
import { failAuth, requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildAttemptAnalysis } from "@/lib/library-analysis";
import { describeScope, describeSubjects, normalizeScope, parseScope } from "@/lib/scope";
import { parseForm } from "@/lib/form";

function parseAnswer(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function GET() {
  try {
    const user = await requireStudent();
    const forms = await prisma.testForm.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        sessions: {
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: { scoreReport: true, responses: true },
        },
      },
    });

    const data = forms.map((form) => {
      const topics = JSON.parse(form.topicTags) as string[];
      const payload = parseForm(form.payloadJson);
      const formScope = normalizeScope(payload.scope);
      const formSubjects = payload.subjects || [];
      const attempts = form.sessions
        .filter((session) => session.status !== "discarded")
        .map((session) => {
          const answers: Record<string, unknown> = {};
          for (const row of session.responses) answers[row.itemId] = parseAnswer(row.valueJson);
          let analysis = null;
          if (session.scoreReport) {
            try {
              analysis = buildAttemptAnalysis({
                formJson: form.payloadJson,
                scopeJson: session.scopeJson,
                answers,
                readingRoute: session.readingRoute,
                listeningRoute: session.listeningRoute,
                timingJson: session.timingJson,
                score: session.scoreReport,
              });
            } catch {
              analysis = null;
            }
          }
          return {
            id: session.id,
            mode: session.mode,
            scope: parseScope(session.scopeJson),
            scopeLabel: describeScope(parseScope(session.scopeJson)),
            status: session.status,
            createdAt: session.createdAt.toISOString(),
            completedAt: session.completedAt?.toISOString() ?? null,
            currentPointer: session.currentPointer,
            bands: analysis?.bands || null,
            classic30: analysis?.classic30 || null,
            analysis,
          };
        });
      const completedBands = attempts.map((attempt) => attempt.bands).filter(Boolean) as Array<Record<string, number>>;
      const latest = completedBands[0]?.overall;
      const best = completedBands.reduce<number | undefined>((acc, bands) => {
        if (bands.overall == null) return acc;
        return acc == null ? bands.overall : Math.max(acc, bands.overall);
      }, undefined);
      return {
        id: form.id,
        createdAt: form.createdAt.toISOString(),
        topics,
        scope: formScope,
        scopeLabel: describeScope(formScope),
        subjects: formSubjects,
        subjectsLabel: describeSubjects(formSubjects),
        difficulty: form.difficulty || "standard",
        attemptCount: attempts.length,
        latestOverall: latest ?? null,
        bestOverall: best ?? null,
        attempts,
      };
    });

    return NextResponse.json({ forms: data });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
