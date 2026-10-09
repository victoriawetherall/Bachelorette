"use client";

import Link from "next/link";
import { readOverallScores } from "@/lib/liveQuiz";
import { formatPoints } from "@/lib/feud";
import { useQuizResource } from "@/lib/useQuizResource";
import QuizConnection from "./QuizConnection";
import QuizRoundNav from "./QuizRoundNav";

export default function OverallScores({ large = false, host = false }: { large?: boolean; host?: boolean }) {
  const { state, error, refresh } = useQuizResource(readOverallScores);
  return <main className={`mx-auto space-y-6 px-4 py-8 ${large ? "max-w-7xl" : "max-w-3xl"}`}>
    <header className="text-center"><p className="text-sm font-semibold text-rose-500">Liv’s hens quiz</p><h1 className={`${large ? "text-5xl" : "text-3xl"} font-bold text-rose-800`}>Overall scores 🏆</h1><p className="mt-3 text-sm text-gray-600">Points from all five rounds added together. Equal totals share a place.</p></header>
    {host && <p className="text-center text-sm font-semibold text-rose-600"><Link href="/tv" target="_blank" rel="noopener noreferrer" className="underline">Open TV ↗</Link></p>}
    <QuizRoundNav host={host} display={large} /><QuizConnection error={error} loading={!state} refresh={refresh} />
    <ol className="space-y-4">{state?.map((team) => <li key={team.id} className="rounded-2xl border-2 border-rose-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className={`${large ? "text-3xl" : "text-xl"} font-bold text-rose-800`}>#{1 + state.filter((t) => Number(t.total) > Number(team.total)).length} · {team.name}</h2><p className={`${large ? "text-5xl" : "text-3xl"} font-bold text-rose-700 tabular-nums`}>{formatPoints(team.total)} <span className="text-sm">pts</span></p></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">{[["Family Feud", team.feud], ["Trivia", team.family], ["Facebook", team.fake], ["Ben", team.ben], ["Final", team.final]].map(([label, points]) => <div key={label}><dt className="text-gray-600">{label}</dt><dd className="font-bold text-rose-800">{formatPoints(Number(points))}</dd></div>)}</dl></li>)}</ol>
  </main>;
}
