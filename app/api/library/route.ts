import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeScope, parseScope } from "@/lib/scope";

export async function GET() {
  try {
    const user = await requireUser();
    const forms = await prisma.testForm.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        sessions: {
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: { scoreReport: true },
        },
      },
    });

    const data = forms.map((form) => {
      const topics = JSON.parse(form.topicTags) as string[];
      const attempts = form.sessions
        .filter((s) => s.status !== "discarded")
        .map((s) => {
          const bands = s.scoreReport ? (JSON.parse(s.scoreReport.bandsJson) as Record<string, number>) : null;
          const concordance = s.scoreReport
            ? (JSON.parse(s.scoreReport.concordanceJson) as { classic30?: Record<string, number> })
            : null;
          return {
            id: s.id,
            mode: s.mode,
            scope: parseScope(s.scopeJson),
            scopeLabel: describeScope(parseScope(s.scopeJson)),
            status: s.status,
            createdAt: s.createdAt.toISOString(),
            completedAt: s.completedAt?.toISOString() ?? null,
            bands,
            classic30: concordance?.classic30 || null,
            currentPointer: s.currentPointer,
          };
        });
      const completedBands = attempts.map((a) => a.bands).filter(Boolean) as Array<Record<string, number>>;
      const latest = completedBands[0]?.overall;
      const best = completedBands.reduce<number | undefined>((acc, b) => {
        if (b.overall == null) return acc;
        return acc == null ? b.overall : Math.max(acc, b.overall);
      }, undefined);
    return {
      id: form.id,
      createdAt: form.createdAt.toISOString(),
      topics,
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
