import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { appendActivity } from "@/lib/activity-log";
import { sessionRecordingDir } from "@/lib/paths";
import { saveResponse, SessionLockedError } from "@/lib/sessions";
import { transcribeFile } from "@/lib/stt";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireSessionForUser(id);
    const form = await req.formData();
    const itemId = String(form.get("itemId") || "");
    const file = form.get("file");
    let transcript = String(form.get("transcript") || "").trim();
    if (!itemId || !(file instanceof File)) {
      return NextResponse.json({ error: "itemId and file required" }, { status: 400 });
    }
    const dir = sessionRecordingDir(id);
    fs.mkdirSync(dir, { recursive: true });
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "webm";
    const abs = path.join(dir, `${itemId}.${ext}`);
    fs.writeFileSync(abs, Buffer.from(await file.arrayBuffer()));
    const rel = path.join("data", "recordings", id, `${itemId}.${ext}`).replaceAll("\\", "/");
    if (!transcript) {
      transcript = await transcribeFile(abs);
    }
    await saveResponse(id, itemId, { recorded: true, transcript }, { recordingPath: rel, transcript });
    appendActivity(user.id, "exam", "Saved a speaking recording");
    return NextResponse.json({ path: rel, transcript });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
