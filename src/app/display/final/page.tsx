"use client";

import FinalRoundView from "@/components/FinalRoundView";
import QuizConnection from "@/components/QuizConnection";
import QuizRoundNav from "@/components/QuizRoundNav";
import { readFinalState } from "@/lib/finalRound";
import { useQuizResource } from "@/lib/useQuizResource";

export default function FinalDisplayPage() {
  const { state, error, refresh } = useQuizResource(readFinalState);
  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-6 md:px-8">
    <header className="space-y-2 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-rose-500">Liv&rsquo;s hens quiz · Round 5</p><h1 className="text-3xl font-bold text-rose-800 md:text-5xl">Final Round 💍</h1></header>
    <QuizRoundNav display />
    <QuizConnection error={error} loading={!state} refresh={refresh} />
    {state && <FinalRoundView state={state} large />}
  </main>;
}
