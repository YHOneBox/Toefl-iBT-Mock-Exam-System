import { NextResponse } from "next/server";
import { failAuth, requireStudent } from "@/lib/auth";
import { createSession } from "@/lib/sessions";
import type { ScopePart, SessionMode } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = (await req.json()) as {
      formId?: string;
      mode?: SessionMode;
      scope?: ScopePart[];
      sourceSessionId?: string;
      allowReadapt?: boolean;
    };
    if (!body.formId || !body.mode) {
      return NextResponse.json({ error: "formId and mode required" }, { status: 400 });
    }
    const session = await createSession({
      formId: body.formId,
      mode: body.mode,
      scope: body.scope,
      sourceSessionId: body.sourceSessionId,
      allowReadapt: body.allowReadapt,
      userId: user.id,
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Could not start" }, { status: 500 })
    );
  }
}
