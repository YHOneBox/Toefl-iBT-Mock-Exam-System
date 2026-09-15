import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { appendActivity } from "@/lib/activity-log";
import { failAuth, requireFormForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hideJobsForForm } from "@/lib/generation/jobs";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireFormForUser(id);
    const started = await prisma.examSession.count({
      where: { formId: id, userId: user.id, status: { not: "discarded" } },
    });
    if (started > 0) {
      return NextResponse.json({ error: "This paper already has a sitting and cannot be deleted" }, { status: 409 });
    }
    await prisma.testForm.delete({ where: { id } });
    hideJobsForForm(user.id, id);
    appendActivity(user.id, "generate", "Deleted an unused prepared paper");
    const audio = path.join(process.cwd(), "data", "audio", id);
    if (fs.existsSync(audio)) fs.rmSync(audio, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
