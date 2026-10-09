"use client";

import { useCallback, useEffect, useState } from "react";
import BenLive from "@/components/BenLive";
import FinalRoundView from "@/components/FinalRoundView";
import FitToScreen from "@/components/FitToScreen";
import LiveFeud from "@/components/LiveFeud";
import QuizConnection from "@/components/QuizConnection";
import QuizLive from "@/components/QuizLive";
import { formatPoints } from "@/lib/feud";
import { readFinalState } from "@/lib/finalRound";
import { readCaptains, readLiveState, readOverallScores, type OverallTeam } from "@/lib/liveQuiz";
import { currentRound, readProgress, type FlowRound } from "@/lib/quizFlow";
import { useBenState } from "@/lib/useBenState";
import { useFeudState } from "@/lib/useFeudState";
import { useQuizResource } from "@/lib/useQuizResource";
import { useQuizTeams } from "@/lib/useQuizTeams";

// The TV follows whatever round Harry has started, like the phones do. It only
// calls public functions and never has the host code, so it can't show an
// answer or an author before the reveal.

const ROUND_INFO: Record<FlowRound["slug"], { emoji: string; rules: string }> = {
  feud: { emoji: "🪩", rules: "Liv picks her answers live. Every pre-vote that matches hers scores for your team." },
  family: { emoji: "📜", rules: "Tales from the family vault. Four answers each, only one really happened. Captains lock in your team’s pick." },
  fake: { emoji: "🕵️", rules: "Three real Facebook posts. One fake. Captains, can your team spot it?" },
  ben: { emoji: "🤵", rules: "We asked Ben. Liv answers live. Your team calls it: will she match Ben’s answer?" },
  final: { emoji: "💍", rules: "Liv picks her favourite marriage advice, blind. The writers’ teams score 5, 3 and 1." },
};

function useSiteAddress() {
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  return host;
}

function FullScreenButton() {
  const [full, setFull] = useState(true);
  useEffect(() => {
    const update = () => setFull(!!document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  if (full) return null;
  return <button type="button" onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
    className="absolute bottom-3 right-3 z-10 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow hover:bg-white">Go full screen ⛶</button>;
}

const rankOf = (teams: OverallTeam[], team: OverallTeam) => 1 + teams.filter((other) => Number(other.total) > Number(team.total)).length;

function Leaderboard({ teams }: { teams: OverallTeam[] }) {
  return <ol className="space-y-3">{teams.map((team) => <li key={team.id} className="flex items-center justify-between gap-4 rounded-2xl border-2 border-rose-200 bg-white px-6 py-4">
    <span className="text-3xl font-bold text-rose-800"><span className="text-rose-400">#{rankOf(teams, team)}</span> {team.name}</span>
    <span className="text-4xl font-bold tabular-nums text-rose-700">{formatPoints(Number(team.total))} <span className="text-lg">pts</span></span>
  </li>)}</ol>;
}

function useOverall() {
  const { state, error, refresh } = useQuizResource(readOverallScores);
  const teams = state ? [...state].sort((a, b) => Number(b.total) - Number(a.total) || a.team_number - b.team_number) : null;
  return { teams, error, refresh };
}

function WelcomeSlide() {
  const host = useSiteAddress();
  const { teams } = useQuizTeams();
  const { state: feud } = useFeudState();
  const { state: captains } = useQuizResource(readCaptains);
  return <FitToScreen><div className="space-y-8 p-2 text-center">
    <header className="space-y-3">
      <p className="text-6xl" aria-hidden="true">🪩💍🥂</p>
      <h1 className="text-7xl font-bold text-rose-800">Liv&rsquo;s Hens Quiz</h1>
      <p className="text-2xl text-gray-700">On your phone: <span className="font-bold text-rose-700">{host || "liv-bachelorette.vercel.app"}</span> → Quiz tab → <span className="font-bold text-rose-700">Let the games begin 🎉</span></p>
    </header>
    <div className="grid grid-cols-4 gap-4 text-left">{teams.map((team) => {
      const captain = captains?.find((item) => item.team_id === team.id);
      const progress = feud?.teams.find((item) => item.id === team.id);
      return <section key={team.id} className="space-y-3 rounded-3xl border-2 border-rose-200 bg-white p-5">
        <h2 className="text-3xl font-bold text-rose-800">{team.name}</h2>
        <p className="text-lg font-semibold text-violet-700">🫡 Captain: {captain?.name ?? "to be picked"}</p>
        <ul className="space-y-1 text-xl text-gray-800">{team.quiz_team_members.map((member) => <li key={member.guest_id}>{member.display_name}</li>)}</ul>
        {progress && feud?.voting_open && <p className="rounded-xl bg-rose-50 p-2 text-lg font-semibold text-rose-700">{progress.completed_voters}/{progress.eligible_voters} pre-quizzes done</p>}
      </section>;
    })}</div>
    {feud && !feud.voting_open && <p className="text-2xl font-semibold text-rose-700">Pre-votes are locked in. Round 1 is about to begin!</p>}
  </div></FitToScreen>;
}

function BetweenRoundsSlide({ next }: { next: FlowRound }) {
  const { teams, error, refresh } = useOverall();
  return <FitToScreen><div className="grid grid-cols-5 items-start gap-8 p-2">
    <section className="col-span-3 space-y-4">
      <h1 className="text-5xl font-bold text-rose-800">Leaderboard 🏆</h1>
      <QuizConnection error={error} loading={!teams} refresh={refresh} />
      {teams && <Leaderboard teams={teams} />}
    </section>
    <section className="col-span-2 space-y-4 rounded-3xl border-2 border-violet-300 bg-violet-50 p-8 text-center">
      <p className="text-xl font-bold uppercase tracking-widest text-violet-600">Up next · Round {next.number}</p>
      <p className="text-7xl" aria-hidden="true">{ROUND_INFO[next.slug].emoji}</p>
      <h2 className="text-5xl font-bold text-violet-900">{next.title}</h2>
      <p className="text-2xl text-violet-900">{ROUND_INFO[next.slug].rules}</p>
    </section>
  </div></FitToScreen>;
}

function ChampionSlide() {
  const { teams, error, refresh } = useOverall();
  const { teams: rosters } = useQuizTeams();
  const winners = teams?.filter((team) => rankOf(teams, team) === 1) ?? [];
  return <FitToScreen><div className="space-y-8 p-2 text-center">
    <QuizConnection error={error} loading={!teams} refresh={refresh} />
    {winners.length > 0 && <header className="space-y-3">
      <p className="text-7xl" aria-hidden="true">🏆🎉🥂</p>
      <p className="text-3xl font-bold uppercase tracking-widest text-rose-500">{winners.length > 1 ? "It’s a tie! Your champions" : "Your champions"}</p>
      {winners.map((team) => <div key={team.id}>
        <h1 className="text-8xl font-bold text-rose-800">{team.name}</h1>
        <p className="mt-2 text-2xl text-gray-700">{rosters.find((item) => item.id === team.id)?.quiz_team_members.map((member) => member.display_name).join(" · ")}</p>
      </div>)}
    </header>}
    {teams && <div className="mx-auto max-w-4xl text-left"><Leaderboard teams={teams} /></div>}
  </div></FitToScreen>;
}

function LiveRound({ round }: { round: FlowRound }) {
  return <div className="flex h-full flex-col">
    <header className="flex items-center justify-between bg-rose-600 px-8 py-3 text-white">
      <p className="text-3xl font-bold"><span aria-hidden="true">{ROUND_INFO[round.slug].emoji}</span> Round {round.number} · {round.title}</p>
      <p className="text-xl font-semibold text-rose-100">Liv&rsquo;s hens quiz</p>
    </header>
    <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
      {round.slug === "feud" ? <FeudTv />
        : round.slug === "family" || round.slug === "fake" ? <LiveQuizTv round={round.slug} />
        : round.slug === "ben" ? <BenTv />
        : <FinalTv />}
    </div>
  </div>;
}

function FeudTv() {
  const { state, error, refresh } = useFeudState();
  return <><QuizConnection error={error} loading={!state} refresh={refresh} />{state && <FitToScreen><LiveFeud state={state} large /></FitToScreen>}</>;
}

function LiveQuizTv({ round }: { round: "family" | "fake" }) {
  const read = useCallback(() => readLiveState(round, null), [round]);
  const { state, error, refresh } = useQuizResource(read);
  return <><QuizConnection error={error} loading={!state} refresh={refresh} />{state && <FitToScreen><QuizLive state={state} large /></FitToScreen>}</>;
}

function BenTv() {
  const { state, error, refresh } = useBenState(null);
  return <><QuizConnection error={error} loading={!state} refresh={refresh} />{state && <FitToScreen><BenLive state={state} large /></FitToScreen>}</>;
}

function FinalTv() {
  const { state, error, refresh } = useQuizResource(readFinalState);
  return <><QuizConnection error={error} loading={!state} refresh={refresh} />{state && <FitToScreen><FinalRoundView state={state} large /></FitToScreen>}</>;
}

export default function TvPage() {
  const { state: progress, error, refresh } = useQuizResource(readProgress);
  const round = progress ? currentRound(progress) : null;
  return <main className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-rose-100 via-rose-50 to-violet-100">
    {!progress && <div className="m-auto w-full max-w-xl"><QuizConnection error={error} loading refresh={refresh} /></div>}
    {progress && error && <div className="absolute left-3 top-3 z-10 max-w-md"><QuizConnection error={error} loading={false} refresh={refresh} /></div>}
    {progress && round && (round.live ? <LiveRound key={round.live.slug} round={round.live} />
      : <div className="flex min-h-0 flex-1 flex-col px-10 py-8">
        {progress.feud === "lobby" ? <WelcomeSlide /> : round.next ? <BetweenRoundsSlide key={round.next.slug} next={round.next} /> : <ChampionSlide />}
      </div>)}
    <FullScreenButton />
  </main>;
}
