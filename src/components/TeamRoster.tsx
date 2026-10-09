import type { QuizTeam } from "@/lib/quizTeams";

const TEAM_STYLES = [
  { card: "border-rose-200", heading: "bg-rose-100 text-rose-800", icon: "🌹" },
  { card: "border-violet-200", heading: "bg-violet-100 text-violet-800", icon: "🪩" },
  { card: "border-amber-200", heading: "bg-amber-100 text-amber-900", icon: "🤠" },
  { card: "border-teal-200", heading: "bg-teal-100 text-teal-800", icon: "✨" },
];

export default function TeamRoster({
  teams,
  guestId,
}: {
  teams: QuizTeam[];
  guestId?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {teams.map((team) => {
        const style = TEAM_STYLES[team.team_number - 1] ?? TEAM_STYLES[0];
        const isYourTeam = team.quiz_team_members.some(
          (member) => member.guest_id === guestId
        );

        return (
          <section
            key={team.id}
            aria-labelledby={`team-${team.id}`}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${style.card} ${
              isYourTeam ? "ring-2 ring-rose-400 ring-offset-2 ring-offset-rose-50" : ""
            }`}
          >
            <div className={`flex items-center justify-between gap-2 px-5 py-4 ${style.heading}`}>
              <h2 id={`team-${team.id}`} className="text-lg font-bold">
                <span aria-hidden="true">{style.icon} </span>
                {team.name}
              </h2>
              {isYourTeam ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-rose-700">
                  Your team
                </span>
              ) : (
                <span className="text-xs font-medium">
                  {team.quiz_team_members.length} players
                </span>
              )}
            </div>
            <ul className="divide-y divide-gray-100 px-5 py-1">
              {team.quiz_team_members.map((member) => (
                <li key={member.guest_id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <span className={member.guest_id === guestId ? "font-semibold text-rose-700" : "text-gray-700"}>
                    {member.display_name}
                  </span>
                  {member.guest_id === guestId && (
                    <span className="text-xs font-medium text-rose-600">You</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
