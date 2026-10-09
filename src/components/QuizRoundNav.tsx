import Link from "next/link";

export default function QuizRoundNav({ host = false, display = false }: { host?: boolean; display?: boolean }) {
  const prefix = host ? "/control" : display ? "/display" : "/quiz";
  return <nav aria-label="Quiz rounds" className="flex flex-wrap justify-center gap-2 text-sm font-semibold text-rose-700">
    {[["", "1 · Family Feud"], ["/fake", "2 · Real or Fake"], ["/stories", "3 · Story Time"], ["/ben", "4 · What Did Ben Say?"], ["/family", "5 · Family Trivia"], ["/scoreboard", "Overall scores"]].map(([path, label]) =>
      <Link key={path} href={`${prefix}${path}`} className="rounded-xl border border-rose-200 bg-white px-3 py-2 hover:bg-rose-100">{label}</Link>)}
  </nav>;
}
