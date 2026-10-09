import { formatPoints, type FeudState } from "@/lib/feud";

export default function FeudScoreboard({ state, showMatches = false, large = false }: { state: FeudState; showMatches?: boolean; large?: boolean }) {
  const teams = [...state.teams].sort((a, b) => b.points - a.points || a.team_number - b.team_number);
  return (
    <section className="space-y-3" aria-label="Team scores">
      <h2 className="text-lg font-bold text-rose-800">{state.phase === "finished" ? "Final scores 🏆" : "Team scores"}</h2>
      <ol className={`grid gap-3 sm:grid-cols-2 ${large ? "lg:grid-cols-4" : ""}`}>
        {teams.map((team) => (
          <li key={team.id} className={`rounded-2xl border border-rose-200 bg-white ${large ? "p-4" : "p-5"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-rose-800">{team.name}</span>
              <span className="text-2xl font-bold tabular-nums text-rose-700">{formatPoints(team.points)} <span className="text-xs font-medium">pts</span></span>
            </div>
            {showMatches && <p className="mt-2 text-sm text-gray-600">{team.matching_names.length ? `Matched Liv: ${team.matching_names.join(", ")}` : "No matches on this one"}</p>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-gray-600">{state.revealed_count} of {state.total_questions} answers revealed · {state.scoring === "matches" ? "1 point per matching guest" : "Scores adjusted for eligible team size"}</p>
    </section>
  );
}
