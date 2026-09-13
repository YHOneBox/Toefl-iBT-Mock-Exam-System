import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { failAuth, requireFormForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireFormForUser(id);
    await prisma.testForm.delete({ where: { id } });
    const audio = path.join(process.cwd(), "data", "audio", id);
    if (fs.existsSync(audio)) fs.rmSync(audio, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
