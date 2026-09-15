import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeSession } from "@/lib/serialize";
import { advanceSession, SessionLockedError } from "@/lib/sessions";
import { enqueueScoreSession } from "@/lib/score-session";

export const maxDuration = 800;

async function loadSession(id: string) {
  return prisma.examSession.findUnique({
    where: { id },
    include: { form: true, responses: true, scoreReport: true },
  });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    const updated = await advanceSession(id);
    if (updated.currentPointer === "scoring" || updated.currentPointer === "completed") {
      enqueueScoreSession(id);
    }
    const session = await loadSession(id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    if (err instanceof SessionLockedError) {
      const { id } = await params;
      const session = await loadSession(id);
      if (session && (session.status === "scoring" || session.currentPointer === "scoring")) {
        enqueueScoreSession(id);
        return NextResponse.json(serializeSession(session));
      }
      if (session && (session.status === "completed" || session.currentPointer === "completed")) {
        return NextResponse.json(serializeSession(session));
      }
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
