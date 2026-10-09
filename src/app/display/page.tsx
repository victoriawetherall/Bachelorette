"use client";

import LiveFeud from "@/components/LiveFeud";
import QuizConnection from "@/components/QuizConnection";
import { useFeudState } from "@/lib/useFeudState";

export default function DisplayPage() {
  const { state, error, refresh } = useFeudState();
  return <main className="mx-auto max-w-6xl space-y-6 px-6 py-6 md:px-8">
    <header className="space-y-2 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-rose-500">Liv&rsquo;s hens quiz</p><h1 className="text-3xl font-bold text-rose-800 md:text-4xl">Family Feud 🪩</h1></header>
    <QuizConnection error={error} loading={!state} refresh={refresh} />
    {state && <LiveFeud state={state} large />}
  </main>;
}
