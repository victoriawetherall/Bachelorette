import { notFound } from "next/navigation";
import LiveQuizDisplay from "@/components/LiveQuizDisplay";
import { isLiveRound } from "@/lib/liveQuiz";

export default async function RoundPage({ params }: { params: Promise<{ round: string }> }) {
  const { round } = await params;
  if (!isLiveRound(round)) notFound();
  return <LiveQuizDisplay key={round} round={round} />;
}
