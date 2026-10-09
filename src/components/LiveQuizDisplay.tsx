"use client";

import { useCallback } from "react";
import QuizConnection from "./QuizConnection";
import QuizLive from "./QuizLive";
import QuizRoundNav from "./QuizRoundNav";
import { readLiveState, type LiveRound } from "@/lib/liveQuiz";
import { useQuizResource } from "@/lib/useQuizResource";

export default function LiveQuizDisplay({ round }: { round: LiveRound }) {
  const read = useCallback(() => readLiveState(round, null), [round]);
  const { state, error, refresh } = useQuizResource(read);
  return <main className="min-h-screen bg-rose-50 px-6 py-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="text-center"><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Liv’s hens quiz · Round {round === "fake" ? "2" : "3"}</p><h1 className="text-4xl font-bold text-rose-800">{round === "fake" ? "Real or Fake" : "Story Time"}</h1></header>
    <QuizRoundNav display /><QuizConnection error={error} loading={!state} refresh={refresh} />
    {state && <QuizLive state={state} large />}
  </div></main>;
}
