import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { appendActivity } from "@/lib/activity-log";
import { persistSpeakingRecording } from "@/lib/recordings";
import { saveResponse, SessionLockedError } from "@/lib/sessions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireSessionForUser(id);
    const form = await req.formData();
    const itemId = String(form.get("itemId") || "");
    const file = form.get("file");
    const transcript = String(form.get("transcript") || "").trim();
    if (!itemId || !(file instanceof File)) {
      return NextResponse.json({ error: "itemId and file required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rel } = await persistSpeakingRecording(id, itemId, buffer, file.type || "", file.name || `${itemId}.webm`);
    await saveResponse(id, itemId, { recorded: true, transcript }, { recordingPath: rel, transcript: transcript || undefined });
    appendActivity(user.id, "exam", "Saved a speaking recording");
    return NextResponse.json({ path: rel, transcript });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
