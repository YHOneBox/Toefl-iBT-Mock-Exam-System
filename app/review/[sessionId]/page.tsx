import { redirect } from "next/navigation";
import { ReviewApp } from "@/components/review/review-app";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export default async function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (isAdminUser(user)) redirect("/users");
  const { sessionId } = await params;
  return <ReviewApp sessionId={sessionId} />;
}
