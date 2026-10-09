"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QuizCaptain from "./QuizCaptain";
import QuizConnection from "./QuizConnection";
import QuizLive from "./QuizLive";
import QuizRoundNav from "./QuizRoundNav";
import { useGuest } from "@/lib/useGuest";
import { useQuizResource } from "@/lib/useQuizResource";
import { readLiveState, submitLiveAnswer, type LiveRound } from "@/lib/liveQuiz";

export default function LiveQuizGuest({ round }: { round: LiveRound }) {
  const guest = useGuest();
  const read = useCallback(() => readLiveState(round, guest?.id ?? null), [round, guest?.id]);
  const { state, error: connectionError, refresh } = useQuizResource(read);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = state?.teams.find((item) => item.id === state.my_team_id);
  const canSubmit = !!guest && team?.captain_id === guest.id && state?.phase === "question";
  useEffect(() => { setAnswer(team?.answer ?? ""); setError(null); }, [state?.current_question_id, team?.answer]);
  async function submit() {
    if (!guest || !state?.current_question_id || !canSubmit || busy) return;
    setBusy(true); setError(null);
    try { await submitLiveAnswer(round, guest.id, state.current_question_id, answer); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save your answer."); refresh(); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
    <header className="text-center"><p className="text-sm font-semibold text-rose-500">Round {round === "fake" ? "2" : "3"} · Liv’s hens quiz</p><h1 className="text-3xl font-bold text-rose-800">{round === "fake" ? "Real or Fake" : "Story Time"}</h1>{team && <p className="mt-2 text-sm text-rose-700">{team.name} · {guest?.name}</p>}</header>
    <QuizRoundNav />
    <QuizConnection error={connectionError} loading={!state} refresh={refresh} />
    {team && <QuizCaptain captain={{ team_id: team.id, guest_id: team.captain_id, name: team.captain_name }} guestId={guest?.id} isLiv={guest?.id === state?.liv_guest_id} refresh={refresh} />}
    {state && <QuizLive state={state} selected={answer} onSelect={setAnswer} disabled={!canSubmit || busy || !!connectionError} />}
    {state?.phase === "question" && <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5">
      {canSubmit && round === "stories" && <label className="block font-semibold text-rose-800">Your team’s answer<textarea maxLength={500} value={answer} disabled={busy} onChange={(event) => setAnswer(event.target.value)} className="mt-2 block min-h-28 w-full rounded-xl border border-rose-200 p-3 font-normal text-gray-800" /></label>}
      {canSubmit && <button type="button" disabled={busy || !!connectionError || !answer.trim()} onClick={() => void submit()} className="w-full rounded-xl bg-rose-600 p-3 font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : team?.submitted ? "Update team answer" : "Submit team answer"}</button>}
      <p className="text-sm text-gray-600">{team?.submitted ? `Saved team answer: ${team.answer}. Your captain can change it until Harry locks answers.` : canSubmit ? round === "fake" ? "Tap a post above, then submit. You can change it until Harry locks answers." : "Type one shared answer. You can change it until Harry locks answers." : "Discuss your answer with your captain."}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>}
    <Link href={`/?next=${encodeURIComponent(`/quiz/${round}`)}`} className="block text-center text-sm text-rose-600 underline">Change your name</Link>
  </main>;
}
