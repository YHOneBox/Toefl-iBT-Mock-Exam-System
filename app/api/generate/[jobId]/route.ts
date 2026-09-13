import { NextResponse } from "next/server";
import { failAuth, requireStudent } from "@/lib/auth";
import { getJobForUser } from "@/lib/generation/jobs";

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
