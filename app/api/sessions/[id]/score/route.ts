import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { enqueueScoreSession } from "@/lib/score-session";

export const maxDuration = 800;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { session } = await requireSessionForUser(id);
    if (session.status === "completed" || session.currentPointer === "completed") {
      return NextResponse.json({ error: "This test is already submitted and cannot be changed" }, { status: 409 });
    }
    if (session.status !== "scoring" && session.currentPointer !== "scoring") {
      return NextResponse.json({ error: "This test is not ready to score" }, { status: 409 });
    }
    enqueueScoreSession(id);
    return NextResponse.json({ ok: true, status: "scoring" });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Scoring failed" }, { status: 500 })
    );
  }
}
