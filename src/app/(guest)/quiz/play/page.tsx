"use client";

import Link from "next/link";
import { useState } from "react";
import BenGuest from "@/components/BenGuest";
import FinalRoundView from "@/components/FinalRoundView";
import LiveFeud from "@/components/LiveFeud";
import LiveQuizGuest from "@/components/LiveQuizGuest";
import QuizConnection from "@/components/QuizConnection";
import { readFinalState } from "@/lib/finalRound";
import { readCaptains, type Captain } from "@/lib/liveQuiz";
import { currentRound, pickCaptain, readProgress, type FlowRound, type QuizProgress } from "@/lib/quizFlow";
import type { QuizTeam } from "@/lib/quizTeams";
import { useFeudState } from "@/lib/useFeudState";
import { useGuest } from "@/lib/useGuest";
import { useQuizResource } from "@/lib/useQuizResource";
import { useQuizTeams } from "@/lib/useQuizTeams";

const button = "w-full rounded-xl bg-rose-600 p-3 font-semibold text-white disabled:opacity-40";

function CaptainPicker({ guestId, team, livId, refresh }: { guestId: string; team: QuizTeam; livId: string; refresh: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = team.quiz_team_members.filter((member) => member.guest_id !== livId);
  const chosen = options.find((member) => member.guest_id === selected);
  async function confirm() {
    if (!selected || busy) return;
    setBusy(true); setError(null);
    try { await pickCaptain(guestId, selected); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t save your captain."); }
    finally { setBusy(false); refresh(); }
  }
  return <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
    <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Step 1 · {team.name}</p>
    <h2 className="text-2xl font-bold text-rose-800">Who&rsquo;s your captain? 🫡</h2>
    <p className="text-sm text-gray-600">Talk it over with your team. The captain submits your team&rsquo;s answers for Trivia, Facebook Archaeologist and What Did Ben Say?</p>
    <div className="grid grid-cols-2 gap-3">{options.map((member) => <button key={member.guest_id} type="button" aria-pressed={selected === member.guest_id} disabled={busy} onClick={() => setSelected(member.guest_id)}
      className={`rounded-xl border-2 p-3 font-semibold ${selected === member.guest_id ? "border-rose-500 bg-rose-100 text-rose-900" : "border-rose-100 bg-white text-gray-800"}`}>
      {member.display_name}{member.guest_id === guestId ? " (me)" : ""}</button>)}</div>
    <button type="button" disabled={!chosen || busy} onClick={() => void confirm()} className={button}>{busy ? "Saving…" : chosen ? `Make ${chosen.display_name} captain` : "Tap your captain"}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}

function FeudRound({ isLiv }: { isLiv: boolean }) {
  const { state, error, refresh } = useFeudState();
  return <section className="space-y-5">
    <header className="text-center"><p className="text-sm font-semibold text-rose-500">Round 1 · Liv’s hens quiz</p><h2 className="text-3xl font-bold text-rose-800">Family Feud</h2></header>
    <QuizConnection error={error} loading={!state} refresh={refresh} />
    <p className="rounded-xl bg-rose-100 p-3 text-center text-sm text-rose-800">{isLiv ? "Shout out your pick. It decides the points!" : "Your pre-votes are locked in. Watch Liv choose!"}</p>
    {state && <LiveFeud state={state} />}
  </section>;
}

function FinalRound() {
  const { state, error, refresh } = useQuizResource(readFinalState);
  return <section className="space-y-5">
    <header className="text-center"><p className="text-sm font-semibold text-rose-500">Round 5 · Liv’s hens quiz</p><h2 className="text-3xl font-bold text-rose-800">Final Round 💍</h2></header>
    <QuizConnection error={error} loading={!state} refresh={refresh} />
    <p className="rounded-xl bg-rose-100 p-3 text-center text-sm text-rose-800">Liv is ranking the advice blind, one card at a time. Her top five score for the writer&rsquo;s team!</p>
    {state && <FinalRoundView state={state} />}
  </section>;
}

function WaitingRoom({ next, progress, team, captain, isLiv }: {
  next: FlowRound | null; progress: QuizProgress; team: QuizTeam | undefined; captain: Captain | undefined; isLiv: boolean;
}) {
  const started = progress.feud !== "lobby";
  return <section className="space-y-4">
    <div className="space-y-3 rounded-3xl border border-rose-200 bg-white p-6 text-center">
      <p className="text-4xl" aria-hidden="true">{next ? "⏳" : "🏆"}</p>
      {next ? <>
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Up next · Round {next.number}</p>
        <h2 className="text-3xl font-bold text-rose-800">{next.title}</h2>
        <p className="text-gray-600">Sit tight. This screen will switch over by itself when Harry starts the round.</p>
      </> : <>
        <h2 className="text-3xl font-bold text-rose-800">That&rsquo;s a wrap!</h2>
        <p className="text-gray-600">Thanks for playing. Check the final scores below.</p>
      </>}
    </div>
    {team && <p className="rounded-2xl bg-rose-50 p-4 text-center text-sm text-rose-800"><span className="font-bold">{team.name}</span>{captain?.name ? ` · Captain: ${captain.name}` : ""}<br />{team.quiz_team_members.map((member) => member.display_name).join(" · ")}</p>}
    {!started && !isLiv && <Link href="/quiz/pre-vote" className="block rounded-xl border-2 border-rose-300 bg-white p-4 text-center font-semibold text-rose-700">Finish your Family Feud pre-quiz &amp; marriage advice →</Link>}
    {started && <Link href="/quiz/scoreboard" className="block rounded-xl border-2 border-rose-300 bg-white p-4 text-center font-semibold text-rose-700">See the overall scores 🏆</Link>}
  </section>;
}

export default function PlayPage() {
  const guest = useGuest();
  const { state: progress, error, refresh } = useQuizResource(readProgress);
  const { state: captains, error: captainError, refresh: refreshCaptains } = useQuizResource(readCaptains);
  const { teams, error: teamError, retry } = useQuizTeams();
  const team = teams.find((item) => item.quiz_team_members.some((member) => member.guest_id === guest?.id));
  const captain = captains?.find((item) => item.team_id === team?.id);
  const isLiv = !!guest && guest.id === progress?.liv_guest_id;
  const needsCaptain = !!guest && !!team && !!captain && !captain.guest_id && !isLiv;
  const round = progress ? currentRound(progress) : null;
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
    {!round?.live && <header className="text-center"><p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Liv&rsquo;s hens quiz</p><h1 className="text-3xl font-bold text-rose-800">Let the games begin 🎉</h1></header>}
    <QuizConnection error={error} loading={!progress} refresh={refresh} />
    {captainError && <QuizConnection error={captainError} loading={false} refresh={refreshCaptains} />}
    {teamError && <QuizConnection error={teamError} loading={false} refresh={retry} />}
    {guest && team && progress && needsCaptain && <CaptainPicker guestId={guest.id} team={team} livId={progress.liv_guest_id} refresh={refreshCaptains} />}
    {progress && round && !needsCaptain && (
      round.live?.slug === "feud" ? <FeudRound isLiv={isLiv} />
      : round.live?.slug === "family" || round.live?.slug === "fake" ? <LiveQuizGuest key={round.live.slug} round={round.live.slug} embedded />
      : round.live?.slug === "ben" ? <BenGuest embedded />
      : round.live?.slug === "final" ? <FinalRound />
      : <WaitingRoom next={round.next} progress={progress} team={team} captain={captain} isLiv={isLiv} />)}
    <Link href="/quiz" className="block text-center text-sm font-medium text-rose-600 underline underline-offset-4">Back to the Quiz tab</Link>
  </main>;
}
