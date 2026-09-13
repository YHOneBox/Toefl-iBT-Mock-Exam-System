import { after, NextResponse } from "next/server";
import { failAuth, requireStudent } from "@/lib/auth";
import { parseDifficulty } from "@/lib/generation/difficulty";
import { enqueuePrepJob, listJobsForUser, llmReady, PREP_JOB_LIMIT_MS, runPrepJob } from "@/lib/generation/jobs";

export const maxDuration = 800;

export async function GET() {
  try {
    const user = await requireStudent();
    return NextResponse.json({
      jobs: listJobsForUser(user.id),
      llmReady: llmReady(),
      jobLimitMs: PREP_JOB_LIMIT_MS,
    });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = (await req.json().catch(() => ({}))) as { difficulty?: string; intent?: string };
    const intent = body.intent === "prepare" ? "prepare" : "start";
    const job = enqueuePrepJob(user.id, parseDifficulty(body.difficulty), intent);
    after(() => {
      void runPrepJob(job.id);
    });
    return NextResponse.json({ jobId: job.id, job });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Could not start preparation" }, { status: 500 })
    );
  }
}
