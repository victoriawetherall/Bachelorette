"use client";

import Link from "next/link";
import { useState } from "react";
import BenLive, { BenQuestionCard, BenScoreboard } from "@/components/BenLive";
import QuizConnection from "@/components/QuizConnection";
import { saveBenPrediction } from "@/lib/ben";
import { useBenState } from "@/lib/useBenState";
import { useGuest } from "@/lib/useGuest";

export default function BenRoundPage() {
  const guest = useGuest();
  const { state, error: connectionError, refresh } = useBenState(guest?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = state?.teams.find((item) => item.id === state.my_team_id);
  const isLiv = !!guest && guest.id === state?.liv_guest_id;
  async function predict(livRight: boolean) {
    if (!guest || !state?.current_question_id || saving) return;
    setSaving(true); setError(null);
    try { await saveBenPrediction(guest.id, state.current_question_id, livRight); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save your team’s call."); refresh(); }
    finally { setSaving(false); }
  }
  const choice = (livRight: boolean, label: string) => {
    const picked = team?.prediction === livRight;
    return <button type="button" aria-pressed={picked} disabled={saving || !!connectionError} onClick={() => void predict(livRight)}
      className={`flex-1 rounded-2xl border-2 p-5 text-lg font-bold transition disabled:opacity-50 ${picked
        ? livRight ? "border-emerald-600 bg-emerald-100 text-emerald-900" : "border-red-500 bg-red-100 text-red-900"
        : "border-rose-200 bg-white text-gray-800 hover:border-rose-400"}`}>{label}</button>;
  };
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
    <header className="space-y-2 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Liv&rsquo;s hens quiz</p>
      <h1 className="text-3xl font-bold text-rose-800">What Did Ben Say? 🤵</h1>
      {team && <p className="text-sm font-semibold text-rose-700">You&rsquo;re playing for {team.name}, {guest?.name}!</p>}
    </header>
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {state && !team && <p className="rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">You&rsquo;re not on a quiz team, so you can watch along.</p>}
    {state && (state.phase === "lobby" || state.phase === "leaderboard" || state.phase === "finished") && <BenLive state={state} />}
    {state && !["lobby", "leaderboard", "finished"].includes(state.phase) && <>
      <BenQuestionCard state={state} />
      {state.phase === "question" && team && (isLiv
        ? <p className="rounded-2xl bg-rose-100 p-4 text-center font-semibold text-rose-800">You&rsquo;re in the hot seat, Liv! Your teammates make the call 💖</p>
        : <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5">
          <h2 className="text-center text-lg font-bold text-rose-800">Will Liv match Ben&rsquo;s answer?</h2>
          <div className="flex gap-3">{choice(true, "She’ll get it ✅")}{choice(false, "She’ll miss it ❌")}</div>
          <p className="text-center text-sm text-gray-600">{team.prediction === null
            ? "One call per team. Any teammate can lock it in."
            : `${team.name}'s call is saved. You can change it until Harry locks the calls.`}</p>
        </section>)}
      {state.phase !== "question" && team && <p className="rounded-2xl bg-rose-100 p-3 text-center font-semibold text-rose-800">Your team&rsquo;s call: {team.prediction === null ? "none 😬" : team.prediction ? "Liv gets it ✅" : "Liv misses ❌"}</p>}
      <BenScoreboard state={state} />
    </>}
    <Link href="/quiz" className="block text-center text-sm font-medium text-rose-600 underline underline-offset-4">Back to the quiz</Link>
  </main>;
}
