import { redirect } from "next/navigation";
import { ExamApp } from "@/components/exam/exam-app";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (isAdminUser(user)) redirect("/users");
  if (user) {
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    if (
      session &&
      session.userId === user.id &&
      (session.status === "completed" || session.currentPointer === "completed")
    ) {
      redirect(`/review/${sessionId}`);
    }
  }
  return <ExamApp sessionId={sessionId} />;
}
