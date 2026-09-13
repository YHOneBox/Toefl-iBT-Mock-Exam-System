import { ReviewApp } from "@/components/review/review-app";

export default async function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ReviewApp sessionId={sessionId} />;
}
