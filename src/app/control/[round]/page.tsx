import { notFound } from "next/navigation";
import LiveQuizHost from "@/components/LiveQuizHost";
import { isLiveRound } from "@/lib/liveQuiz";

export default async function RoundPage({ params }: { params: Promise<{ round: string }> }) {
  const { round } = await params;
  if (!isLiveRound(round)) notFound();
  return <LiveQuizHost key={round} round={round} />;
}
