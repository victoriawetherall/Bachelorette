"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QuizAccess from "@/components/QuizAccess";
import QuizConnection from "@/components/QuizConnection";
import FeudQuestionCard from "@/components/FeudQuestionCard";
import FeudScoreboard from "@/components/FeudScoreboard";
import { FEUD_QUESTIONS, chooseFeudAnswer, correctFeudAnswer, hostFeudAction, type AnswerKey } from "@/lib/feud";
import { useFeudState } from "@/lib/useFeudState";

function HostDashboard({ accessKey, lock }: { accessKey: string; lock: () => void }) {
  const { state, error: connectionError, refresh } = useFeudState(accessKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<AnswerKey | null>(null);
  const [correctionQuestion, setCorrectionQuestion] = useState(1);
  const [correctionOption, setCorrectionOption] = useState<AnswerKey>("A");
  useEffect(() => { setSelection(null); setError(null); }, [state?.current_question_id]);
  const question = FEUD_QUESTIONS.find((item) => item.id === state?.current_question_id);
  async function run(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await operation(); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update the quiz."); refresh(); }
    finally { setBusy(false); }
  }
  const action = (name: string) => run(() => hostFeudAction(accessKey, name, state?.current_question_id ?? null));
  const disabled = busy || !!connectionError;
  const button = "rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-40";
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Host controls · private</p><h1 className="text-3xl font-bold text-rose-800">Family Feud</h1></div><div className="flex flex-wrap gap-4 text-sm font-semibold text-rose-600"><Link href="/display" target="_blank" rel="noopener noreferrer" className="underline">Open Zoom display ↗</Link><Link href="/control/ben" className="underline">What Did Ben Say?</Link><Link href="/admin/teams" className="underline">Teams</Link><button type="button" onClick={lock} className="underline">Lock controls</button></div></header>
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {state?.phase === "lobby" && <section className="space-y-5 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">Before you start</h2>
      <p className="text-sm text-gray-600">{state.voting_open ? "Pre-voting is open." : "Pre-voting is closed."} Starting the round locks every guest’s saved answers.</p>
      <label className="block space-y-2 text-sm font-semibold text-gray-700">Scoring
        <select value={state.scoring} disabled={disabled} onChange={(event) => void action(event.target.value === "adjusted" ? "score_adjusted" : "score_matches")} className="block w-full rounded-xl border border-rose-200 bg-white p-3">
          <option value="matches">1 point per matching guest</option><option value="adjusted">Adjust for eligible team size</option>
        </select>
      </label>
      <p className="text-sm text-gray-600">Liv chooses live, so Team 2 has three pre-voters; other teams have four. Adjusted scoring scales each team to four eligible voters. Missing votes earn zero.</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={disabled} onClick={() => void action(state.voting_open ? "close_votes" : "open_votes")} className="rounded-xl border border-rose-300 px-4 py-3 font-semibold text-rose-700 disabled:opacity-40">{state.voting_open ? "Close pre-voting" : "Reopen pre-voting"}</button><button type="button" disabled={disabled} onClick={() => void action("start")} className={button}>Lock votes & start question 1</button></div>
      <p className="text-sm text-gray-600">Liv opens <Link href="/quiz/liv" className="font-semibold text-rose-600 underline">her quiz screen</Link> and enters her private access code.</p>
    </section>}
    {state && state.phase !== "lobby" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <p className="text-sm font-semibold text-rose-600">{state.phase === "finished" ? "Round complete" : `Question ${state.current_question_id} of ${state.total_questions}`}</p>
      <p className="text-lg font-bold text-rose-800">{state.phase === "question" ? "Waiting for Liv’s choice" : state.phase === "locked" ? `Liv picked ${state.pending_option}. Ready to reveal.` : state.phase === "finished" ? "All answers have been revealed!" : "Results are on screen"}</p>
      <div className="flex flex-wrap gap-3">
        {state.phase === "locked" && <><button type="button" disabled={disabled} onClick={() => void action("reveal")} className={button}>Reveal & score</button><button type="button" disabled={disabled} onClick={() => void action("reopen_choice")} className="rounded-xl border border-rose-300 px-4 py-3 text-rose-700 disabled:opacity-40">Let Liv choose again</button></>}
        {(state.phase === "reveal" || state.phase === "leaderboard") && <><button type="button" disabled={disabled} onClick={() => void action("next")} className={button}>{state.current_question_id === state.total_questions ? "Finish round" : "Next question"}</button>{state.phase === "reveal" && <button type="button" disabled={disabled} onClick={() => void action("leaderboard")} className="rounded-xl border border-rose-300 px-4 py-3 text-rose-700 disabled:opacity-40">Show leaderboard</button>}</>}
      </div>
    </section>}
    {question && state?.phase !== "finished" && <FeudQuestionCard question={question} correct={state?.chosen_option} selected={state?.pending_option} distribution={state?.distribution} />}
    {state?.phase === "question" && question && <details className="rounded-2xl border border-rose-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-rose-700">Enter Liv&rsquo;s choice for her</summary><div className="mt-4 space-y-4"><p className="text-sm text-gray-600">Use this if Liv says her answer aloud or cannot use her phone.</p><div className="flex gap-2">{(["A","B","C","D"] as AnswerKey[]).map((key) => <button key={key} type="button" aria-pressed={selection === key} disabled={disabled} onClick={() => setSelection(key)} className={`flex-1 rounded-xl border p-3 font-bold ${selection === key ? "border-rose-500 bg-rose-100" : "border-rose-200"}`}>{key}</button>)}</div><button type="button" disabled={!selection || disabled} onClick={() => selection && void run(() => chooseFeudAnswer(accessKey, question.id, selection))} className={button}>Lock Liv&rsquo;s choice</button></div></details>}
    {state && <FeudScoreboard state={state} showMatches={state.phase === "reveal"} />}
    {state?.submissions && <details open={state.phase === "lobby"} className="rounded-2xl border border-rose-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-rose-800">Pre-vote progress</summary><ul className="mt-3 divide-y divide-rose-100">{state.submissions.map((guest) => <li key={guest.guest_id} className="flex justify-between gap-3 py-3 text-sm"><span>{guest.display_name} <span className="text-gray-500">· Team {guest.team_number}</span></span><span className="font-semibold text-rose-700">{guest.answered}/{state.total_questions}{guest.answered === state.total_questions ? " ✓" : ""}</span></li>)}</ul></details>}
    {!!state?.revealed_count && <details className="rounded-2xl border border-rose-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-rose-800">Correct a revealed answer</summary><div className="mt-4 space-y-3"><p className="text-sm text-gray-600">Scores are recalculated from saved votes. This replaces the recorded choice for that question.</p><label className="block text-sm">Question<select value={correctionQuestion} onChange={(event) => setCorrectionQuestion(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-rose-200 p-3">{FEUD_QUESTIONS.map((item) => <option key={item.id} value={item.id}>{item.id}. {item.prompt}</option>)}</select></label><label className="block text-sm">Correct choice<select value={correctionOption} onChange={(event) => setCorrectionOption(event.target.value as AnswerKey)} className="mt-1 block w-full rounded-xl border border-rose-200 p-3">{FEUD_QUESTIONS.find((item) => item.id === correctionQuestion)?.options.map((option) => <option key={option.key} value={option.key}>{option.key}. {option.text}</option>)}</select></label><button type="button" disabled={disabled} onClick={() => void run(() => correctFeudAnswer(accessKey, correctionQuestion, correctionOption))} className={button}>Correct choice & recalculate</button></div></details>}
  </main>;
}

export default function ControlPage() {
  return <QuizAccess role="host">{(key, lock) => <HostDashboard accessKey={key} lock={lock} />}</QuizAccess>;
}
