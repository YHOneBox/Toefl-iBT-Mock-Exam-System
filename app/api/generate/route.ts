import { after, NextResponse } from "next/server";
import { failAuth, requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseDifficulty } from "@/lib/generation/difficulty";
import type { ScopePart } from "@/lib/types";
import {
  enqueuePrepJob,
  inflightJobCount,
  listJobsForUser,
  llmReady,
  MAX_HELD_PAPERS,
  MAX_PREPARE_BATCH,
  PREP_JOB_LIMIT_MS,
  runPrepJob,
} from "@/lib/generation/jobs";

export const maxDuration = 800;

async function unusedFormCount(userId: string) {
  const forms = await prisma.testForm.findMany({
    where: { userId },
    select: {
      sessions: {
        where: { userId, status: { not: "discarded" } },
        select: { id: true },
        take: 1,
      },
    },
  });
  return forms.filter((form) => form.sessions.length === 0).length;
}

export async function GET() {
  try {
    const user = await requireStudent();
    const unusedCount = await unusedFormCount(user.id);
    const inflight = inflightJobCount(user.id);
    return NextResponse.json({
      jobs: listJobsForUser(user.id),
      llmReady: llmReady(),
      jobLimitMs: PREP_JOB_LIMIT_MS,
      unusedCount,
      inflightCount: inflight,
      heldCount: unusedCount + inflight,
      maxHeldPapers: MAX_HELD_PAPERS,
      maxPrepareBatch: MAX_PREPARE_BATCH,
    });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = (await req.json().catch(() => ({}))) as {
      difficulty?: string;
      intent?: string;
      count?: number;
      scope?: ScopePart[];
      subjects?: string[];
    };
    const intent = body.intent === "prepare" ? "prepare" : "start";
    const difficulty = parseDifficulty(body.difficulty);
    const scope = body.scope;
    const subjects = body.subjects;
    const unusedCount = await unusedFormCount(user.id);
    const inflight = inflightJobCount(user.id);
    const room = MAX_HELD_PAPERS - unusedCount - inflight;
    if (intent === "start" && inflight > 0) {
      return NextResponse.json(
        { error: "A paper is already being prepared. Wait for it, or prepare more for later." },
        { status: 409 },
      );
    }
    const wanted =
      intent === "prepare" ? Math.min(MAX_PREPARE_BATCH, Math.max(1, Math.floor(Number(body.count) || 1))) : 1;
    if (room < 1) {
      return NextResponse.json(
        {
          error: `You already have ${MAX_HELD_PAPERS} unused or queued papers. Start or stop one before preparing more.`,
        },
        { status: 409 },
      );
    }
    const make = Math.min(wanted, room);
    const jobs = Array.from({ length: make }, () => enqueuePrepJob(user.id, difficulty, intent, { scope, subjects }));
    after(() => {
      for (const job of jobs) void runPrepJob(job.id);
    });
    return NextResponse.json({
      jobId: jobs[0].id,
      job: jobs[0],
      jobIds: jobs.map((job) => job.id),
      jobs,
      queued: make,
    });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Could not start preparation" }, { status: 500 })
    );
  }
}
