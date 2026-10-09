"use client";

import { useEffect, useState } from "react";
import QuizAccess from "@/components/QuizAccess";
import QuizConnection from "@/components/QuizConnection";
import FeudQuestionCard from "@/components/FeudQuestionCard";
import FeudScoreboard from "@/components/FeudScoreboard";
import { FEUD_QUESTIONS, chooseFeudAnswer, type AnswerKey } from "@/lib/feud";
import { useFeudState } from "@/lib/useFeudState";

function LivScreen({ accessKey, lock }: { accessKey: string; lock: () => void }) {
  const { state, error: connectionError, refresh } = useFeudState();
  const [selected, setSelected] = useState<AnswerKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSelected(null); setError(null); }, [state?.current_question_id, state?.phase]);
  const question = FEUD_QUESTIONS.find((item) => item.id === state?.current_question_id);
  async function choose() {
    if (!question || !selected || saving) return;
    setSaving(true); setError(null);
    try { await chooseFeudAnswer(accessKey, question.id, selected); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save your choice."); }
    finally { setSaving(false); }
  }
  return <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
    <header className="space-y-2 text-center"><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Liv&rsquo;s screen</p><h1 className="text-3xl font-bold text-rose-800">You make the rules 💖</h1></header>
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {state?.phase === "lobby" && <p className="rounded-2xl bg-white p-6 text-center text-gray-700">Your friends are guessing your answers. When Harry starts the quiz, your first question will appear here.</p>}
    {state?.phase === "question" && question && <>
      <p className="text-sm font-semibold text-rose-600">Question {question.id} of {state.total_questions}</p>
      <FeudQuestionCard question={question} selected={selected} disabled={saving || !!connectionError} onSelect={setSelected} />
      <button type="button" onClick={() => void choose()} disabled={!selected || saving || !!connectionError} className="w-full rounded-xl bg-rose-600 p-3 font-semibold text-white disabled:opacity-40">{saving ? "Locking in…" : "Lock in my choice"}</button>
    </>}
    {state?.phase === "locked" && <section role="status" className="space-y-3 rounded-2xl bg-white p-6 text-center"><p className="text-3xl">🔒</p><h2 className="text-xl font-bold text-rose-800">Your choice is locked in!</h2><p className="text-sm text-gray-600">Harry will reveal it to everyone. The next question will appear automatically.</p></section>}
    {state?.phase === "reveal" && question && <><FeudQuestionCard question={question} correct={state.chosen_option} distribution={state.distribution} /><FeudScoreboard state={state} showMatches /></>}
    {state && (state.phase === "leaderboard" || state.phase === "finished") && <FeudScoreboard state={state} />}
    <button type="button" onClick={lock} className="text-sm text-rose-600 underline">Lock this screen</button>
  </main>;
}

export default function LivPage() {
  return <QuizAccess role="liv">{(key, lock) => <LivScreen accessKey={key} lock={lock} />}</QuizAccess>;
}
