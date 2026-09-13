import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { scoreSession } from "@/lib/score-session";

export const maxDuration = 120;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { session } = await requireSessionForUser(id);
    if (session.status === "completed" || session.currentPointer === "completed") {
      return NextResponse.json({ error: "This test is already submitted and cannot be changed" }, { status: 409 });
    }
    const report = await scoreSession(id);
    return NextResponse.json(report);
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Scoring failed" }, { status: 500 })
    );
  }
}
