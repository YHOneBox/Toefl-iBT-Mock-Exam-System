import { NextResponse } from "next/server";
import { failAuth, requireStudent } from "@/lib/auth";
import { cancelPrepJob, dismissPrepJob, getJobForUser } from "@/lib/generation/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireStudent();
    const { jobId } = await params;
    const job = getJobForUser(user.id, jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireStudent();
    const { jobId } = await params;
    const current = getJobForUser(user.id, jobId);
    if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (current.status === "failed" || current.status === "cancelled") {
      const job = dismissPrepJob(user.id, jobId);
      if (!job) return NextResponse.json({ error: "Could not close this record" }, { status: 409 });
      return NextResponse.json({ job, dismissed: true });
    }
    const job = cancelPrepJob(user.id, jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Could not stop preparation" }, { status: 500 });
  }
}
