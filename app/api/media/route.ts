import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { failAuth, requireFormForUser, requireSessionForUser, requireUser } from "@/lib/auth";

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
    if (rel.startsWith("data/audio/") && parts[2]) {
      await requireFormForUser(parts[2]);
    }
    const abs = path.join(process.cwd(), rel);
    if (!abs.startsWith(path.join(process.cwd(), "data")) || !fs.existsSync(abs)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(abs);
    const type = rel.endsWith(".mp3") ? "audio/mpeg" : rel.endsWith(".wav") ? "audio/wav" : "audio/webm";
    return new NextResponse(Uint8Array.from(buf), { headers: { "Content-Type": type } });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
