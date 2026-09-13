import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeSession } from "@/lib/serialize";
import { discardSession, SessionLockedError, updateNotepad, updateTiming } from "@/lib/sessions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    const session = await prisma.examSession.findUnique({
      where: { id },
      include: { form: true, responses: true, scoreReport: true },
    });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeSession(session));
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    const body = (await req.json()) as { notepad?: string; discard?: boolean; timing?: unknown };
    if (body.discard) {
      await discardSession(id);
      return NextResponse.json({ ok: true });
    }
    if (typeof body.notepad === "string") {
      await updateNotepad(id, body.notepad);
    }
    if (body.timing) {
      await updateTiming(id, body.timing);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    await requireUser();
    await prisma.examSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
