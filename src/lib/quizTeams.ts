import { insforge } from "./insforge";

export type QuizTeamMember = {
  guest_id: string;
  display_name: string;
  seat_number: number;
};

export type QuizTeam = {
  id: string;
  name: string;
  team_number: number;
  quiz_team_members: QuizTeamMember[];
};

export async function loadQuizTeams(): Promise<QuizTeam[]> {
  const { data, error } = await insforge.database
    .from("quiz_teams")
    .select(
      "id, name, team_number, quiz_team_members(guest_id, display_name, seat_number)"
    )
    .order("team_number", { ascending: true });

  if (error) throw new Error("We couldn’t load the teams. Please try again.");

  return ((data as QuizTeam[]) ?? []).map((team) => ({
    ...team,
    quiz_team_members: [...team.quiz_team_members].sort(
      (a, b) => a.seat_number - b.seat_number
    ),
  }));
}

export function formatTeamRoster(teams: QuizTeam[]): string {
  return [
    "Liv’s hens quiz teams 🎉",
    ...teams.map(
      (team) =>
        `${team.name}: ${team.quiz_team_members.map((member) => member.display_name).join(", ")}`
    ),
  ].join("\n\n");
}
