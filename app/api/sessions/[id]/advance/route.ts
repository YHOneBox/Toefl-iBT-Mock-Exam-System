import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeSession } from "@/lib/serialize";
import { advanceSession, SessionLockedError } from "@/lib/sessions";
import { scoreSession } from "@/lib/score-session";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    const updated = await advanceSession(id);
    if (updated.currentPointer === "scoring" || updated.currentPointer === "completed") {
      await scoreSession(id);
    }
    const session = await prisma.examSession.findUnique({
      where: { id },
      include: { form: true, responses: true, scoreReport: true },
    });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    if (err instanceof SessionLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
