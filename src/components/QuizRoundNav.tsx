"use client";

import Link from "next/link";
import { currentRound, readProgress } from "@/lib/quizFlow";
import { useQuizResource } from "@/lib/useQuizResource";

const LINKS = [["", "feud", "1 · Family Feud"], ["/family", "family", "2 · Trivia"], ["/fake", "fake", "3 · Facebook Archaeologist"], ["/ben", "ben", "4 · What Did Ben Say?"], ["/final", "final", "5 · Final Round"], ["/scoreboard", null, "Overall scores"]] as const;

function RoundLinks({ prefix, live }: { prefix: string; live?: string | null }) {
  return <nav aria-label="Quiz rounds" className="flex flex-wrap justify-center gap-2 text-sm font-semibold text-rose-700">
    {LINKS.map(([path, slug, label]) =>
      <Link key={path} href={`${prefix}${path}`} className={`rounded-xl border px-3 py-2 hover:bg-rose-100 ${slug && slug === live ? "border-emerald-500 bg-emerald-50" : "border-rose-200 bg-white"}`}>
        {label}{slug && slug === live && <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white">LIVE</span>}
      </Link>)}
  </nav>;
}

// Host links show which round the room is on, using the same rule as the TV.
function HostRoundLinks() {
  const { state } = useQuizResource(readProgress);
  return <RoundLinks prefix="/control" live={state ? currentRound(state).live?.slug : null} />;
}

export default function QuizRoundNav({ host = false, display = false }: { host?: boolean; display?: boolean }) {
  return host ? <HostRoundLinks /> : <RoundLinks prefix={display ? "/display" : "/quiz"} />;
}
