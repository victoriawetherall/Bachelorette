"use client";

import Link from "next/link";
import { useState } from "react";
import QuizAccess from "@/components/QuizAccess";
import QuizConnection from "@/components/QuizConnection";
import QuizRoundNav from "@/components/QuizRoundNav";
import { BenScoreboard } from "@/components/BenLive";
import { correctBenResult, hostBenAction, predictionLabel } from "@/lib/ben";
import { useBenState } from "@/lib/useBenState";

function BenHost({ accessKey, lock }: { accessKey: string; lock: () => void }) {
  const { state, error: connectionError, refresh } = useBenState(null, accessKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correctionQuestion, setCorrectionQuestion] = useState<number | null>(null);
  const [skipQuestion, setSkipQuestion] = useState<number | null>(null);
  async function run(operation: () => Promise<unknown>) {
    if (busy) return false;
    setBusy(true); setError(null);
    try { await operation(); refresh(); return true; }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update the round."); refresh(); return false; }
    finally { setBusy(false); }
  }
  const action = (name: string) => run(() => hostBenAction(accessKey, name, state?.current_question_id ?? null));
  const disabled = busy || !!connectionError;
  const button = "rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-40";
  const secondary = "rounded-xl border border-rose-300 px-4 py-3 font-semibold text-rose-700 disabled:opacity-40";
  const isLast = state?.question_number === state?.total_questions;
  const judgeable = state && ["reveal", "judged", "leaderboard"].includes(state.phase);
  const judged = state?.questions?.filter((question) => question.liv_right !== null) ?? [];
  const correcting = judged.find((question) => question.id === correctionQuestion) ?? judged[0];
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Host controls · private</p><h1 className="text-3xl font-bold text-rose-800">What Did Ben Say? 🤵</h1></div><div className="flex flex-wrap gap-4 text-sm font-semibold text-rose-600"><Link href="/tv" target="_blank" rel="noopener noreferrer" className="underline">Open TV ↗</Link><Link href="/control" className="underline">Family Feud</Link><button type="button" onClick={lock} className="underline">Lock controls</button></div></header>
    <QuizRoundNav host />
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {skipQuestion !== null && skipQuestion === state?.current_question_id && <section role="alert" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-900">Skip this question? No points will be awarded for it.</p><div className="flex gap-3"><button type="button" disabled={disabled} onClick={() => void run(() => hostBenAction(accessKey,"next",skipQuestion)).then((saved) => { if(saved) setSkipQuestion(null); })} className={button}>Confirm skip</button><button type="button" disabled={busy} onClick={() => setSkipQuestion(null)} className={secondary}>Cancel</button></div></section>}
    {state?.phase === "lobby" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">Before you start</h2>
      <p className="text-sm text-gray-600">Each team&rsquo;s captain opens <span className="font-semibold">/quiz/ben</span> and submits the shared call. Liv answers live and can&rsquo;t vote. Captains carry over from rounds 2–3; guests can volunteer on their screen or you can <Link href="/control/fake" className="font-semibold text-rose-600 underline">choose captains</Link>. The TV (<span className="font-semibold">/tv</span>) follows the round by itself.</p>
      <button type="button" disabled={disabled} onClick={() => void action("start")} className={button}>Start question 1</button>
    </section>}
    {state && state.phase !== "lobby" && state.phase !== "finished" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <p className="text-sm font-semibold text-rose-600">Question {state.question_number} of {state.total_questions}</p>
      <h2 className="text-2xl font-bold text-rose-900">{state.prompt}</h2>
      <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Ben said {state.phase === "question" || state.phase === "locked" ? "· hidden from everyone else" : "· on screen"}</p><p className="mt-1 font-semibold text-violet-900">&ldquo;{state.ben_answer}&rdquo;</p></div>
      <ul className="grid gap-2 sm:grid-cols-2">{state.teams.map((team) => <li key={team.id} className="flex justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm"><span className="font-semibold text-rose-800">{team.name}</span><span>{predictionLabel(team.prediction)}{team.submitted_by && <span className="text-gray-500"> · {team.submitted_by}</span>}</span></li>)}</ul>
      {state.phase === "question" && <div className="flex flex-wrap gap-3"><button type="button" disabled={disabled} onClick={() => void action("lock")} className={button}>Lock team calls</button></div>}
      {state.phase === "locked" && <><p className="font-semibold text-rose-800">Ask Liv the question. When she&rsquo;s answered, reveal Ben&rsquo;s answer.</p><div className="flex flex-wrap gap-3"><button type="button" disabled={disabled} onClick={() => void action("reveal")} className={button}>Reveal Ben&rsquo;s answer</button><button type="button" disabled={disabled} onClick={() => void action("reopen")} className={secondary}>Reopen team calls</button></div></>}
      {judgeable && <div className="space-y-2"><p className="font-semibold text-rose-800">{state.liv_right === null ? "Did Liv get it right?" : `Ruled: ${state.liv_right ? "Liv got it ✅" : "Liv missed ❌"} (tap to change)`}</p><div className="flex gap-3">
        <button type="button" aria-pressed={state.liv_right === true} disabled={disabled} onClick={() => void action("liv_right")} className={`flex-1 rounded-xl border-2 p-4 text-lg font-bold disabled:opacity-40 ${state.liv_right === true ? "border-emerald-600 bg-emerald-100 text-emerald-900" : "border-emerald-300 text-emerald-800"}`}>Right ✅</button>
        <button type="button" aria-pressed={state.liv_right === false} disabled={disabled} onClick={() => void action("liv_wrong")} className={`flex-1 rounded-xl border-2 p-4 text-lg font-bold disabled:opacity-40 ${state.liv_right === false ? "border-red-500 bg-red-100 text-red-900" : "border-red-300 text-red-800"}`}>Wrong ❌</button>
      </div></div>}
      <div className="flex flex-wrap gap-3">
        {(state.phase === "judged" || state.phase === "leaderboard") && <><button type="button" disabled={disabled} onClick={() => void action("next")} className={button}>{isLast ? "Finish round" : "Next question"}</button>{state.phase === "judged" && <button type="button" disabled={disabled} onClick={() => void action("leaderboard")} className={secondary}>Show leaderboard</button>}</>}
        {["question", "locked", "reveal"].includes(state.phase) && <button type="button" disabled={disabled} onClick={() => setSkipQuestion(state.current_question_id)} className="px-1 text-sm text-gray-500 underline disabled:opacity-40">Skip this question</button>}
      </div>
    </section>}
    {state?.phase === "finished" && <p className="rounded-2xl bg-white p-5 text-lg font-bold text-rose-800">Round complete! 🎉</p>}
    {state && <BenScoreboard state={state} />}
    {judged.length > 0 && correcting && <details className="rounded-2xl border border-rose-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-rose-800">Correct an earlier ruling</summary><div className="mt-4 space-y-3"><p className="text-sm text-gray-600">Scores are recalculated from the saved team calls.</p><label className="block text-sm">Question<select value={correcting.id} onChange={(event) => setCorrectionQuestion(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-rose-200 p-3">{judged.map((item) => <option key={item.id} value={item.id}>{item.id}. {item.prompt} ({item.liv_right ? "right" : "wrong"})</option>)}</select></label><div className="flex gap-3"><button type="button" disabled={disabled || correcting.liv_right === true} onClick={() => void run(() => correctBenResult(accessKey, correcting.id, true))} className={secondary}>Mark right ✅</button><button type="button" disabled={disabled || correcting.liv_right === false} onClick={() => void run(() => correctBenResult(accessKey, correcting.id, false))} className={secondary}>Mark wrong ❌</button></div></div></details>}
  </main>;
}

export default function BenControlPage() {
  return <QuizAccess role="host">{(key, lock) => <BenHost accessKey={key} lock={lock} />}</QuizAccess>;
}
