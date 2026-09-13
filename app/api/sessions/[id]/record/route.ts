import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { failAuth, requireSessionForUser } from "@/lib/auth";
import { sessionRecordingDir } from "@/lib/paths";
import { saveResponse, SessionLockedError } from "@/lib/sessions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSessionForUser(id);
    const form = await req.formData();
    const itemId = String(form.get("itemId") || "");
    const file = form.get("file");
    const transcript = String(form.get("transcript") || "");
    if (!itemId || !(file instanceof File)) {
      return NextResponse.json({ error: "itemId and file required" }, { status: 400 });
    }
    const dir = sessionRecordingDir(id);
    fs.mkdirSync(dir, { recursive: true });
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "webm";
    const abs = path.join(dir, `${itemId}.${ext}`);
    fs.writeFileSync(abs, Buffer.from(await file.arrayBuffer()));
    const rel = path.join("data", "recordings", id, `${itemId}.${ext}`).replaceAll("\\", "/");
    await saveResponse(id, itemId, { recorded: true, transcript }, { recordingPath: rel, transcript });
    return NextResponse.json({ path: rel });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
