"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TeamRoster from "@/components/TeamRoster";
import LiveFeud from "@/components/LiveFeud";
import QuizConnection from "@/components/QuizConnection";
import { readBallot } from "@/lib/feud";
import { ROUND_ORDER, readProgress } from "@/lib/quizFlow";
import { useFeudState } from "@/lib/useFeudState";
import { useGuest } from "@/lib/useGuest";
import { useQuizResource } from "@/lib/useQuizResource";
import { useQuizTeams } from "@/lib/useQuizTeams";

export default function QuizPage() {
  const guest = useGuest();
  const { state, error, refresh } = useFeudState();
  const { state: progress } = useQuizResource(readProgress);
  const { teams, error: teamError, retry: retryTeams } = useQuizTeams();
  const [answered, setAnswered] = useState<number | null>(null);
  useEffect(() => {
    let stopped = false;
    if (guest?.id) void readBallot(guest.id).then((ballot) => {
      if (!stopped) setAnswered(Object.keys(ballot.answers).length);
    }).catch(() => {});
    return () => { stopped = true; };
  }, [guest?.id, state?.voting_open]);
  const team = teams.find((item) => item.quiz_team_members.some((member) => member.guest_id === guest?.id));
  const isLiv = guest?.id === state?.liv_guest_id;
  const isLobby = state?.phase === "lobby";
  // Opens by itself once Harry closes pre-voting (or any round has started).
  const gamesOpen = (!!state && !state.voting_open) || (!!progress && ROUND_ORDER.some((round) => progress[round.slug] && progress[round.slug] !== "lobby"));
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
    <header className="space-y-2 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Liv&rsquo;s hens quiz</p>
      <h1 className="text-3xl font-bold text-rose-800">{isLobby || !state ? "Meet your quiz crew 🪩" : "Family Feud"}</h1>
      {team && <p className="text-sm font-semibold text-rose-700">You&rsquo;re on {team.name}, {guest?.name}!</p>}
    </header>
    {gamesOpen
      ? <Link href="/quiz/play" className="block rounded-2xl bg-rose-600 px-4 py-5 text-center text-xl font-bold text-white hover:bg-rose-700">Let the games begin 🎉</Link>
      : <p aria-disabled="true" className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 px-4 py-5 text-center text-xl font-bold text-rose-400">Quiz · coming soon 🎉</p>}
    <QuizConnection error={error} loading={!state} refresh={refresh} />
    {teamError && <QuizConnection error={teamError} loading={false} refresh={retryTeams} />}
    {isLobby && <>
      {team && <section className="rounded-2xl border border-rose-200 bg-white p-5 text-center">
        <p className="font-bold text-rose-800">Your teammates</p>
        <p className="mt-2 text-sm text-gray-700">{team.quiz_team_members.map((member) => member.display_name).join(" · ")}</p>
      </section>}
      <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
        <h2 className="text-xl font-bold text-rose-800">How well do you know Liv?</h2>
        <p className="text-sm text-gray-600">Pick your answers to {state.total_questions} questions before the quiz. Liv will choose her answers live. Each match helps your team!</p>
        {!isLiv && answered !== null && <p className="text-sm font-semibold text-rose-700">{answered} of {state.total_questions} answers saved</p>}
        {!isLiv && <Link href="/quiz/pre-vote" className="block rounded-xl bg-rose-600 px-4 py-3 text-center font-semibold text-white hover:bg-rose-700">
          {!state.voting_open ? "View your locked answers" : answered === state.total_questions ? "Review your pre-votes" : answered ? "Continue your pre-votes" : "Answer the pre-quiz"}
        </Link>}
        {isLiv && <p className="text-sm text-gray-600">You get to choose on the night. Just shout out your answers. Your teammates are voting beforehand!</p>}
      </section>
      <LiveFeud state={state} />
    </>}
    {state && !isLobby && <>
      <p className="rounded-xl bg-rose-100 p-3 text-center text-sm text-rose-800">{isLiv ? "Shout out your pick. It decides the points!" : "Your pre-votes are locked in. Watch Liv choose!"}</p>
      <LiveFeud state={state} />
    </>}
    <Link href="/quiz/ben" className="block rounded-xl border-2 border-violet-300 bg-violet-50 p-4 text-center font-semibold text-violet-800 hover:bg-violet-100">Playing &ldquo;What Did Ben Say?&rdquo; 🤵 Tap here</Link>
    {teams.length > 0 && <details className="rounded-2xl border border-rose-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-rose-800">All four teams</summary><div className="mt-5"><TeamRoster teams={teams} guestId={guest?.id} /></div></details>}
    <Link href="/?next=%2Fquiz" className="block text-center text-sm font-medium text-rose-600 underline underline-offset-4">Not {guest?.name}? Change your name</Link>
  </main>;
}
