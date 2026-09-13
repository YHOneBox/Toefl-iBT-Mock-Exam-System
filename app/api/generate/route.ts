import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { parseDifficulty } from "@/lib/generation/difficulty";
import { createNewTest } from "@/lib/sessions";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { difficulty?: string };
    const session = await createNewTest(user.id, parseDifficulty(body.difficulty));
    return NextResponse.json({ sessionId: session.id, formId: session.formId });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 })
    );
  }
}
