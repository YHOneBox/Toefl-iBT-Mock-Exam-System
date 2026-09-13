import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { saveResponse, SessionLockedError } from "@/lib/sessions";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    const body = (await req.json()) as {
      itemId?: string;
      value?: unknown;
      transcript?: string;
    };
    if (!body.itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    await saveResponse(id, body.itemId, body.value, { transcript: body.transcript });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
