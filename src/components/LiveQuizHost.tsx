"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import QuizAccess from "./QuizAccess";
import QuizConnection from "./QuizConnection";
import QuizLive, { LiveScores } from "./QuizLive";
import QuizRoundNav from "./QuizRoundNav";
import { useQuizTeams } from "@/lib/useQuizTeams";
import { useQuizResource } from "@/lib/useQuizResource";
import { configureLiveRound, editLiveQuestion, judgeLiveAnswer, LIVE_ROUNDS, liveAction, readLiveState, setCaptain, type LiveRound } from "@/lib/liveQuiz";
import StoryReview from "./StoryReview";

const primary = "rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-40";
const secondary = "rounded-xl border border-rose-300 bg-white px-4 py-3 font-semibold text-rose-700 disabled:opacity-40";

function Host({ round, accessKey, lock }: { round: LiveRound; accessKey: string; lock: () => void }) {
  const read = useCallback(() => readLiveState(round, null, accessKey), [round, accessKey]);
  const { state, error: connectionError, refresh } = useQuizResource(read);
  const { teams: roster, error: rosterError, retry: retryRoster } = useQuizTeams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [confirmation, setConfirmation] = useState<{ action: "lock" | "skip"; questionId: number; message: string } | null>(null);
  async function run(operation: () => Promise<unknown>) {
    if (busy) return false;
    setBusy(true); setError(null);
    try { await operation(); refresh(); return true; }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t update the quiz."); refresh(); return false; }
    finally { setBusy(false); }
  }
  const action = (name: string) => run(() => liveAction(accessKey, round, name, state?.current_question_id ?? null));
  const disabled = busy || !!connectionError;
  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    if (await run(() => editLiveQuestion(accessKey, round, editing, prompt, answer, true))) { setEditing(null); setPrompt(""); setAnswer(""); }
  }
  const pending = state?.teams.some((team) => team.submitted && team.correct === null);
  const correctText = state?.options.find((option) => option.key === state.correct_answer)?.text;
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-rose-500">Host controls · private</p><h1 className="text-3xl font-bold text-rose-800">{LIVE_ROUNDS[round].title}</h1></div><div className="flex gap-4 text-sm font-semibold text-rose-600"><Link href={`/display/${round}`} target="_blank" rel="noopener noreferrer" className="underline">Open Zoom display ↗</Link><button type="button" onClick={lock} className="underline">Lock controls</button></div></header>
    <QuizRoundNav host />
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {confirmation && confirmation.questionId === state?.current_question_id && <section role="alert" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"><p className="font-semibold text-amber-900">{confirmation.message}</p><div className="flex gap-3"><button type="button" disabled={disabled} onClick={() => void run(() => liveAction(accessKey, round, confirmation.action, confirmation.questionId)).then((saved) => { if (saved) setConfirmation(null); })} className={primary}>{confirmation.action === "lock" ? "Confirm lock" : "Confirm skip"}</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)} className={secondary}>Cancel</button></div></section>}
    {state?.phase === "lobby" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">Before you start</h2>
      <label className="block text-sm font-semibold text-gray-700">Points per correct team<select value={state.points_per_correct} disabled={disabled} onChange={(event) => void run(() => configureLiveRound(accessKey, round, Number(event.target.value)))} className="mt-2 block w-full rounded-xl border border-rose-200 p-3">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "point" : "points"}</option>)}</select></label>
      <p className="text-sm text-gray-600">One shared answer per team. Missing answers earn zero. The overall leaderboard adds points from all five rounds.</p>
      <button type="button" disabled={disabled || !state.total_questions} onClick={() => void action("start")} className={primary}>Start round · {state.total_questions} {state.total_questions === 1 ? "question" : "questions"}</button>
    </section>}
    {state && <details open={state.phase === "lobby"} className="rounded-2xl border border-rose-200 bg-white p-5"><summary className="cursor-pointer font-bold text-rose-800">Team captains</summary><div className="mt-4 space-y-3">
      <p className="text-sm text-gray-600">Guests can volunteer on their team screen. Use these selectors to choose or change captains. The same captain submits for rounds 2–5.</p>
      {rosterError && <QuizConnection error={rosterError} loading={false} refresh={retryRoster} />}
      {state.teams.map((team) => <label key={team.id} className="block text-sm font-semibold text-rose-800">{team.name}<select value={team.captain_id ?? ""} disabled={disabled} onChange={(event) => void run(() => setCaptain(accessKey, team.id, event.target.value))} className="mt-1 block w-full rounded-xl border border-rose-200 p-3"><option value="" disabled>Choose a captain</option>{roster.find((t) => t.id === team.id)?.quiz_team_members.filter((m) => m.guest_id !== state.liv_guest_id).map((m) => <option key={m.guest_id} value={m.guest_id}>{m.display_name}</option>)}</select></label>)}
    </div></details>}
    {state?.phase === "lobby" && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="text-xl font-bold text-rose-800">{round === "fake" ? "Choose your image sets" : round === "family" ? "Trivia questions" : "Story Time questions"}</h2>
      {round === "stories" && <form onSubmit={(event) => void saveQuestion(event)} className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Question<textarea required maxLength={2000} value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-1 block min-h-24 w-full rounded-xl border border-rose-200 p-3" /></label>
        <label className="block text-sm font-semibold text-gray-700">Answer / accepted answers<textarea required maxLength={2000} value={answer} onChange={(event) => setAnswer(event.target.value)} className="mt-1 block min-h-20 w-full rounded-xl border border-rose-200 p-3" /></label>
        <p className="text-sm text-gray-600">The answer stays private until you reveal it. Teams type their answers; you judge them after revealing.</p>
        <div className="flex gap-3"><button type="submit" disabled={disabled || !prompt.trim() || !answer.trim()} className={primary}>{editing ? "Save question" : "Add question"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setPrompt(""); setAnswer(""); }} className={secondary}>Cancel edit</button>}</div>
      </form>}
      <ul className="divide-y divide-rose-100">{state.questions?.map((q) => <li key={q.id} className="flex items-start gap-3 py-3"><input aria-label={`Include question ${q.position}`} type="checkbox" checked={q.enabled} disabled={disabled} onChange={(event) => void run(() => editLiveQuestion(accessKey, round, q.id, q.prompt, q.answer, event.target.checked))} className="mt-1 h-5 w-5 accent-rose-600" /><div className="flex-1"><p className="text-sm font-semibold text-rose-800">{q.position}. {q.prompt}</p>{round === "stories" && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{q.answer}</p>}</div>{round === "stories" && <button type="button" disabled={disabled} onClick={() => { setEditing(q.id); setPrompt(q.prompt); setAnswer(q.answer); }} className="text-sm font-semibold text-rose-600 underline">Edit</button>}</li>)}</ul>
    </section>}
    {state && !["lobby", "finished"].includes(state.phase) && <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <p className="font-semibold text-rose-800">Question {state.question_number} of {state.total_questions} · {state.teams.filter((t) => t.submitted).length} of {state.teams.length} teams answered</p>
      <div className="flex flex-wrap gap-3">
        {state.phase === "question" && <button type="button" disabled={disabled} onClick={() => { if (state.teams.every((t) => t.submitted)) void action("lock"); else setConfirmation({ action: "lock", questionId: state.current_question_id!, message: "Some teams haven’t answered. Lock now? Missing answers earn zero." }); }} className={primary}>Lock team answers</button>}
        {state.phase === "locked" && <><button type="button" disabled={disabled} onClick={() => void action("reveal")} className={primary}>Reveal {round === "stories" ? "answer" : "& score"}</button><button type="button" disabled={disabled} onClick={() => void action("reopen")} className={secondary}>Reopen answers</button></>}
        {["reveal", "leaderboard"].includes(state.phase) && <><button type="button" disabled={disabled || pending} onClick={() => void action("next")} className={primary}>{state.question_number === state.total_questions ? "Finish round" : "Next question"}</button>{state.phase === "reveal" && <button type="button" disabled={disabled || pending} onClick={() => void action("leaderboard")} className={secondary}>Show round scores</button>}</>}
        {["question", "locked"].includes(state.phase) && <button type="button" disabled={disabled} onClick={() => setConfirmation({ action: "skip", questionId: state.current_question_id!, message: "Skip this question? No points will be awarded." })} className="text-sm text-gray-500 underline">Skip question</button>}
      </div>
      <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900"><strong>Private answer:</strong> {state.correct_answer}{correctText && ` · ${correctText}`}</p>
      {state.story && <div className="rounded-xl bg-violet-50 p-3 text-violet-900"><p className="text-sm font-semibold">Read aloud after the reveal</p><p className="mt-1 whitespace-pre-wrap">{state.story}</p></div>}
    </section>}
    {state && !["lobby", "finished"].includes(state.phase) && <QuizLive state={state} />}
    {state && ["question", "locked", "reveal"].includes(state.phase) && <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="font-bold text-rose-800">{state.phase === "reveal" && round === "stories" ? "Judge team answers" : "Private team answers"}</h2>
      {state.teams.map((team) => <div key={team.id} className="space-y-2 border-t border-rose-100 pt-3"><p className="text-sm font-semibold text-rose-800">{team.name} {team.submitted_by && <span className="font-normal text-gray-500">· {team.submitted_by}</span>}</p><p className="whitespace-pre-wrap break-words text-gray-700">{team.answer ?? "No answer"}</p>{round === "stories" && state.phase === "reveal" && team.submitted && <div className="flex gap-3"><button type="button" aria-pressed={team.correct === true} disabled={disabled} onClick={() => void run(() => judgeLiveAnswer(accessKey, state.current_question_id!, team.id, true))} className={`${secondary} ${team.correct === true ? "bg-emerald-100 border-emerald-500" : ""}`}>Correct ✓</button><button type="button" aria-pressed={team.correct === false} disabled={disabled} onClick={() => void run(() => judgeLiveAnswer(accessKey, state.current_question_id!, team.id, false))} className={`${secondary} ${team.correct === false ? "bg-red-100 border-red-400" : ""}`}>Incorrect</button></div>}</div>)}
      {round === "stories" && state.phase === "reveal" && pending && <p role="status" className="text-sm text-rose-700">Judge every submitted answer before continuing.</p>}
    </section>}
    {state?.phase === "finished" && <LiveScores state={state} />}
    {round === "stories" && !!state?.revealed_count && <StoryReview accessKey={accessKey} questions={state.questions?.filter((q) => q.revealed) ?? []} refresh={refresh} />}
  </main>;
}

export default function LiveQuizHost({ round }: { round: LiveRound }) {
  return <QuizAccess role="host">{(key, lock) => <Host round={round} accessKey={key} lock={lock} />}</QuizAccess>;
}
