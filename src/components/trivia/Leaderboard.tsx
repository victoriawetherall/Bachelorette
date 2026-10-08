import { teamTotals, type TriviaSnapshot } from "@/lib/trivia/types";

export default function Leaderboard({
  data,
  dark = false,
}: {
  data: TriviaSnapshot;
  dark?: boolean;
}) {
  const teams = teamTotals(data.scores).sort((a, b) => b.total - a.total);
  return (
    <section
      aria-label="Team leaderboard"
      className={`rounded-3xl p-5 ${dark ? "bg-white/10" : "border border-rose-100 bg-white shadow-sm"}`}
    >
      <h2
        className={`mb-4 text-lg font-bold ${dark ? "text-pink-200" : "text-rose-800"}`}
      >
        The race for bragging rights 🪩
      </h2>
      <ol className="space-y-3">
        {teams.map(({ team, total }) => (
          <li key={team} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${dark ? "bg-white/10" : "bg-rose-50 text-rose-500"}`}
            >
              {total > 0 && total === teams[0].total
                ? "👑"
                : teams.findIndex((entry) => entry.total === total) + 1}
            </span>
            <span className="min-w-0 flex-1 break-words font-semibold">
              {data.session.team_names[team - 1]}
            </span>
            <span className="text-xl font-bold tabular-nums">
              {total}
              <span className="ml-1 text-xs font-normal opacity-60">pts</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
