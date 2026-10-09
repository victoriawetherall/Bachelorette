"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdviceCard from "@/components/AdviceCard";
import FeudQuestionCard from "@/components/FeudQuestionCard";
import QuizConnection from "@/components/QuizConnection";
import { FEUD_QUESTIONS, readBallot, saveVote, type AnswerKey, type FeudBallot } from "@/lib/feud";
import { useGuest } from "@/lib/useGuest";
import { useFeudState } from "@/lib/useFeudState";

export default function PreVotePage() {
  const guest = useGuest();
  const { state, error: connectionError, refresh } = useFeudState();
  const [ballot, setBallot] = useState<FeudBallot | null>(null);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<AnswerKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    if (!guest) return;
    setError(null);
    void readBallot(guest.id).then((data) => {
      if (stopped) return;
      setBallot(data);
      const firstMissing = FEUD_QUESTIONS.findIndex((question) => !data.answers[question.id]);
      setIndex(firstMissing < 0 ? 0 : firstMissing);
    }).catch((err) => { if (!stopped) setError(err instanceof Error ? err.message : "Couldn’t load your saved answers."); });
    return () => { stopped = true; };
  }, [guest?.id, attempt]);
  const question = FEUD_QUESTIONS[index];
  const completed = Object.keys(ballot?.answers ?? {}).length;
  const votingOpen = !!ballot?.voting_open && state?.voting_open !== false;

  async function choose(option: AnswerKey) {
    if (!guest || !ballot || saving || !votingOpen) return;
    setSaving(true); setPending(option); setError(null);
    try {
      await saveVote(guest.id, question.id, option);
      setBallot((old) => old ? { ...old, answers: { ...old.answers, [question.id]: option } } : old);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your answer hasn’t saved. Please try again.");
      refresh();
    } finally { setSaving(false); setPending(null); }
  }

  return <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
    <Link href="/quiz" className="text-sm font-semibold text-rose-600">← Back to the quiz</Link>
    <header className="space-y-2"><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Family Feud pre-votes</p><h1 className="text-2xl font-bold text-rose-800">What will Liv pick?</h1><p className="text-sm text-gray-600">Choose what you think Liv will choose on the night. Each answer saves when you tap it.</p></header>
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {error && <div role="alert" className="space-y-2 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!ballot && <button type="button" onClick={() => setAttempt((old) => old + 1)} className="font-semibold underline">Try again</button>}</div>}
    {!ballot && !error && <p role="status" className="text-sm text-gray-500">Loading your answers…</p>}
    {ballot && !ballot.eligible && <section className="space-y-4 rounded-2xl bg-white p-5"><p>You get to choose your answers live, Liv! No pre-voting needed. Just shout out your pick when Harry reads each question.</p></section>}
    {ballot?.eligible && <>
      <div className="space-y-2"><p className="text-sm font-semibold text-rose-700">{completed} of {FEUD_QUESTIONS.length} answers saved</p><progress value={completed} max={FEUD_QUESTIONS.length} aria-label="Saved answers" className="h-2 w-full accent-rose-600" /></div>
      {!votingOpen && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pre-voting has closed. These are your locked answers.</p>}
      {completed === FEUD_QUESTIONS.length && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-bold">All 20 answers are saved! 🎉</p><p className="mt-1">{votingOpen ? "You can review and change them until pre-voting closes." : "You’re all set for the live reveal."}</p><p className="mt-1 font-semibold">One last thing: add your marriage advice at the bottom 💍</p></section>}
      <label className="flex items-center justify-between gap-3 text-sm font-semibold text-rose-800">Question
        <select aria-label="Go to question" value={index} disabled={saving} onChange={(event) => { setIndex(Number(event.target.value)); setError(null); }} className="rounded-xl border border-rose-200 bg-white px-3 py-2">
          {FEUD_QUESTIONS.map((q, i) => <option key={q.id} value={i}>{q.id} of {FEUD_QUESTIONS.length}{ballot.answers[q.id] ? " · answered" : ""}</option>)}
        </select>
      </label>
      <FeudQuestionCard question={question} selected={pending ?? ballot.answers[question.id]} disabled={saving || !votingOpen || !!connectionError} onSelect={(option) => void choose(option)} />
      <p role="status" className="min-h-5 text-sm font-semibold text-rose-700">{saving ? "Saving…" : ballot.answers[question.id] ? `Answer ${ballot.answers[question.id]} saved ✓` : "Pick an answer above"}</p>
      <div className="flex gap-3"><button type="button" disabled={index === 0 || saving} onClick={() => { setIndex((old) => old - 1); setError(null); }} className="flex-1 rounded-xl border border-rose-200 bg-white p-3 font-semibold text-rose-700 disabled:opacity-40">Previous</button>
        {index < FEUD_QUESTIONS.length - 1 ? <button type="button" disabled={saving} onClick={() => { setIndex((old) => old + 1); setError(null); }} className="flex-1 rounded-xl bg-rose-600 p-3 font-semibold text-white disabled:opacity-40">Next</button> : <Link href="/quiz" className={`flex-1 rounded-xl bg-rose-600 p-3 text-center font-semibold text-white ${saving ? "pointer-events-none opacity-40" : ""}`}>Back to quiz</Link>}
      </div>
      {guest && (completed === FEUD_QUESTIONS.length || index === FEUD_QUESTIONS.length - 1) && <AdviceCard guestId={guest.id} />}
    </>}
  </main>;
}
