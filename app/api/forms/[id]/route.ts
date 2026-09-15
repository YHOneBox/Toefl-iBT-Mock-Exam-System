import { NextResponse } from "next/server";
import { appendActivity } from "@/lib/activity-log";
import { failAuth, requireFormForUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hideJobsForForm } from "@/lib/generation/jobs";
import { removeFormWithResults } from "@/lib/sessions";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireFormForUser(id);
    const withResults = new URL(req.url).searchParams.get("withResults") === "1";
    const started = await prisma.examSession.count({
      where: { formId: id, userId: user.id, status: { not: "discarded" } },
    });
    if (started > 0 && !withResults) {
      return NextResponse.json({ error: "This paper already has a sitting and cannot be deleted" }, { status: 409 });
    }
    await removeFormWithResults(id, user.id);
    hideJobsForForm(user.id, id);
    appendActivity(
      user.id,
      withResults ? "exam" : "generate",
      withResults ? "Deleted a paper and its sittings" : "Deleted an unused prepared paper",
      withResults ? "Those scores no longer count on the dashboard" : undefined,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
