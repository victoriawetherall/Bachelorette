"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import FinalRoundView from "@/components/FinalRoundView";
import QuizAccess from "@/components/QuizAccess";
import QuizConnection from "@/components/QuizConnection";
import QuizRoundNav from "@/components/QuizRoundNav";
import { MEDALS, finalAction, readFinalHostState } from "@/lib/finalRound";
import { useQuizResource } from "@/lib/useQuizResource";

function FinalHost({ accessKey, lock }: { accessKey: string; lock: () => void }) {
  const read = useCallback(() => readFinalHostState(accessKey), [accessKey]);
  const { state, error: connectionError, refresh } = useQuizResource(read);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: string, rank: number | null = null, other: number | null = null) {
    if (busy) return;
    setBusy(true); setError(null); setSelected(null);
    try { await finalAction(accessKey, action, rank, other); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update the Final Round."); }
    finally { setBusy(false); refresh(); }
  }
  const disabled = busy || !!connectionError;
  const button = "rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-40";
  const secondary = "rounded-xl border-2 border-rose-300 bg-white px-4 py-3 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40";
  const placing = state?.phase === "ranking" && state.current !== null;
  const swapping = state?.phase === "ranking" && state.current === null;
  const swapsLeft = state ? state.max_swaps - state.swaps_used : 0;
  const nextReveal = state ? state.places - state.revealed_places : 0;
  const undoLabel = state?.swaps_used ? "Undo last swap" : "Undo last card";
  const canUndo = state?.phase === "ranking" && (state.swaps_used > 0 || state.entries.some((entry) => entry.rank !== null));
  // Placing goes straight in (Undo fixes a mis-tap). Swapping takes two taps.
  function slot(rank: number) {
    if (disabled) return;
    if (placing) void run("place", rank);
    else if (selected === null) setSelected(rank);
    else if (selected === rank) setSelected(null);
    else void run("swap", selected, rank);
  }
  function lockRanking() {
    if (window.confirm("Lock in Liv’s ranking? No more swaps after this.")) void run("lock");
  }
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Host controls · private</p><h1 className="text-3xl font-bold text-rose-800">Final Round 💍</h1></div><div className="flex flex-wrap gap-4 text-sm font-semibold text-rose-600"><Link href="/tv" target="_blank" rel="noopener noreferrer" className="underline">Open TV ↗</Link><button type="button" onClick={lock} className="underline">Lock controls</button></div></header>
    <QuizRoundNav host />
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {state?.phase === "lobby" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">{state.entry_count} pieces of advice in</h2>
      <p className="text-sm text-gray-600">{state.missing?.length ? `Still to write: ${state.missing.join(", ")}.` : "Everyone has written theirs!"}</p>
      <p className="text-sm text-gray-600">Starting locks the advice and shuffles it. Cards come out one at a time; Liv gives each a spot from #1 (favourite) to #{state.entry_count}, blind. Then she gets {state.max_swaps} swaps. Scoring: the top five earn 5 · 4 · 3 · 2 · 1 for the writer&rsquo;s team.</p>
      <button type="button" disabled={disabled || !state.entry_count} onClick={() => void run("start")} className={button}>Lock advice &amp; start the Final Round</button>
    </section>}
    {state?.phase === "ranking" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      {placing ? <>
        <h2 className="text-xl font-bold text-rose-800">Card {state.current} of {state.entry_count}: read it out</h2>
        <p className="text-sm text-gray-600">Where does Liv put it? Tap a free spot below. The next card comes out straight away.</p>
      </> : <>
        <h2 className="text-xl font-bold text-rose-800">Every card is placed. Liv has {swapsLeft} of {state.max_swaps} swaps left</h2>
        <p className="text-sm text-gray-600">{!swapsLeft ? "No swaps left. Lock it in when Liv’s happy." : selected ? `#${selected} selected. Tap the spot to swap it with.` : "Tap two spots to swap them, or lock it in."}</p>
      </>}
      <div className="flex flex-wrap gap-3">
        {swapping && <button type="button" disabled={disabled} onClick={lockRanking} className={button}>Lock in Liv&rsquo;s ranking 🔒</button>}
        <button type="button" disabled={disabled || !canUndo} onClick={() => void run("undo")} className={secondary}>{undoLabel}</button>
      </div>
    </section>}
    {state?.phase === "reveal" && <section className="flex flex-wrap gap-3">
      {nextReveal >= 1 && <button type="button" disabled={disabled} onClick={() => void run("reveal", nextReveal)} className={button}>Reveal who wrote {MEDALS[nextReveal]} #{nextReveal}</button>}
      {nextReveal === 0 && <button type="button" disabled={disabled} onClick={() => void run("finish")} className={button}>Finish round</button>}
    </section>}
    {state?.phase === "finished" && <p className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">Round complete. The overall scores now include the Final Round.</p>}
    {state && <FinalRoundView state={state} selected={selected} mode={placing ? "place" : swapping && swapsLeft > 0 ? "swap" : undefined} onSlot={slot} />}
  </main>;
}

export default function FinalControlPage() {
  return <QuizAccess role="host">{(key, lock) => <FinalHost accessKey={key} lock={lock} />}</QuizAccess>;
}
