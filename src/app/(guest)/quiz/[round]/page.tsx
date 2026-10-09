import { notFound } from "next/navigation";
import LiveQuizGuest from "@/components/LiveQuizGuest";
import { isLiveRound } from "@/lib/liveQuiz";

export default async function RoundPage({ params }: { params: Promise<{ round: string }> }) {
  const { round } = await params;
  if (!isLiveRound(round)) notFound();
  return <LiveQuizGuest key={round} round={round} />;
}
