"use client";

import BenLive from "@/components/BenLive";
import QuizConnection from "@/components/QuizConnection";
import QuizRoundNav from "@/components/QuizRoundNav";
import { useBenState } from "@/lib/useBenState";

export default function BenDisplayPage() {
  const { state, error, refresh } = useBenState(null);
  return <main className="mx-auto max-w-6xl space-y-6 px-6 py-6 md:px-8">
    <header className="space-y-2 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-rose-500">Liv&rsquo;s hens quiz</p><h1 className="text-3xl font-bold text-rose-800 md:text-5xl">What Did Ben Say? 🤵</h1></header>
    <QuizRoundNav display />
    <QuizConnection error={error} loading={!state} refresh={refresh} />
    {state && <BenLive state={state} large />}
  </main>;
}
