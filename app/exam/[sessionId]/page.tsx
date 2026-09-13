import { redirect } from "next/navigation";
import { ExamApp } from "@/components/exam/exam-app";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSessionLocked } from "@/lib/sessions";

export default async function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (user) {
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    if (session && session.userId === user.id && isSessionLocked(session)) {
      redirect(`/review/${sessionId}`);
    }
  }
  return <ExamApp sessionId={sessionId} />;
}
