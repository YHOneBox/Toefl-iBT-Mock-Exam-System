import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { failAuth, requireFormForUser, requireSessionForUser, requireUser } from "@/lib/auth";
import { audioContentType } from "@/lib/ffmpeg";
import { playableRecordingFile } from "@/lib/recordings";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const rel = url.searchParams.get("path") || "";
    if (!rel.startsWith("data/audio/") && !rel.startsWith("data/recordings/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const parts = rel.split("/");
    if (rel.startsWith("data/recordings/") && parts[2]) {
      await requireSessionForUser(parts[2]);
    }
    if (rel.startsWith("data/audio/") && parts[2] && parts[2] !== "cache") {
      await requireFormForUser(parts[2]);
    }
    let abs = path.join(process.cwd(), rel);
    if (!abs.startsWith(path.join(process.cwd(), "data"))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    let type = audioContentType(abs);
    if (rel.startsWith("data/recordings/")) {
      const playable = await playableRecordingFile(abs);
      if (!playable) return NextResponse.json({ error: "Not found" }, { status: 404 });
      abs = playable.abs;
      type = playable.type;
    } else if (!fs.existsSync(abs)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(abs);
    return new NextResponse(Uint8Array.from(buf), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(buf.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
