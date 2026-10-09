"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import FinalRoundView from "@/components/FinalRoundView";
import QuizAccess from "@/components/QuizAccess";
import QuizConnection from "@/components/QuizConnection";
import QuizRoundNav from "@/components/QuizRoundNav";
import { MEDALS, ORDINALS, finalAction, readFinalHostState } from "@/lib/finalRound";
import { useQuizResource } from "@/lib/useQuizResource";

function FinalHost({ accessKey, lock }: { accessKey: string; lock: () => void }) {
  const read = useCallback(() => readFinalHostState(accessKey), [accessKey]);
  const { state, error: connectionError, refresh } = useQuizResource(read);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: string, place: number | null = null, no: number | null = null) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await finalAction(accessKey, action, place, no); if (action === "award") setSelected(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update the Final Round."); }
    finally { setBusy(false); refresh(); }
  }
  const disabled = busy || !!connectionError;
  const button = "rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-40";
  const picking = state?.phase === "reading" && state.revealed_places === 0;
  const places = Array.from({ length: state?.places ?? 0 }, (_, i) => i + 1);
  const nextReveal = state ? state.places - state.revealed_places : 0;
  const allAwarded = !!state && state.awards.length === state.places;
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Host controls · private</p><h1 className="text-3xl font-bold text-rose-800">Final Round 💍</h1></div><div className="flex flex-wrap gap-4 text-sm font-semibold text-rose-600"><Link href="/tv" target="_blank" rel="noopener noreferrer" className="underline">Open TV ↗</Link><button type="button" onClick={lock} className="underline">Lock controls</button></div></header>
    <QuizRoundNav host />
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {state?.phase === "lobby" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">{state.entry_count} pieces of advice in</h2>
      <p className="text-sm text-gray-600">{state.missing?.length ? `Still to write: ${state.missing.join(", ")}.` : "Everyone has written theirs!"}</p>
      <p className="text-sm text-gray-600">Starting locks the advice and shows every card, numbered and anonymous, on the TV. Scoring: 🥇 5 · 🥈 3 · 🥉 1 to the writer&rsquo;s team.</p>
      <button type="button" disabled={disabled || !state.entry_count} onClick={() => void run("start")} className={button}>Lock advice &amp; start the Final Round</button>
    </section>}
    {picking && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">Read them out, then let Liv choose</h2>
      <p className="text-sm text-gray-600">{selected ? `Card #${selected} selected. Which place did Liv give it?` : "Tap a card below, then tap the place Liv gives it."}</p>
      <div className="flex flex-wrap gap-3">{[...places].reverse().map((place) => <button key={place} type="button" disabled={disabled || !selected} onClick={() => void run("award", place, selected)} className={button}>{MEDALS[place]} {ORDINALS[place]}</button>)}</div>
      <ul className="space-y-2 text-sm">{places.map((place) => { const award = state.awards.find((item) => item.place === place); return <li key={place} className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3">
        <span>{MEDALS[place]} {ORDINALS[place]}: <span className="font-bold">{award ? `#${award.no}` : "not picked yet"}</span></span>
        {award && <button type="button" disabled={disabled} onClick={() => void run("clear", place)} className="text-rose-700 underline disabled:opacity-40">Clear</button>}
      </li>; })}</ul>
    </section>}
    {state?.phase === "reading" && <section className="flex flex-wrap gap-3">
      {nextReveal >= 1 && <button type="button" disabled={disabled || !allAwarded} onClick={() => void run("reveal", nextReveal)} className={button}>Reveal {MEDALS[nextReveal]} {ORDINALS[nextReveal]} place</button>}
      {nextReveal === 0 && <button type="button" disabled={disabled} onClick={() => void run("finish")} className={button}>Finish round</button>}
      {!allAwarded && <p className="self-center text-sm text-gray-600">Pick all {state.places} places to unlock the reveal.</p>}
    </section>}
    {state?.phase === "finished" && <p className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900">Round complete. The overall scores now include the Final Round.</p>}
    {state && <FinalRoundView state={state} selected={selected} onSelect={picking ? setSelected : undefined} />}
  </main>;
}

export default function FinalControlPage() {
  return <QuizAccess role="host">{(key, lock) => <FinalHost accessKey={key} lock={lock} />}</QuizAccess>;
}
