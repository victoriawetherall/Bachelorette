"use client";

import { useState } from "react";
import AdminGate from "@/components/AdminGate";
import AdminNav from "@/components/AdminNav";
import TeamRoster from "@/components/TeamRoster";
import TeamsStatus from "@/components/TeamsStatus";
import { formatTeamRoster } from "@/lib/quizTeams";
import { useQuizTeams } from "@/lib/useQuizTeams";

function TeamsOverview() {
  const { teams, loading, error, retry } = useQuizTeams();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const ready = !loading && !error && teams.length > 0;
  const playerCount = teams.reduce((count, team) => count + team.quiz_team_members.length, 0);

  async function copyRoster() {
    try {
      await navigator.clipboard.writeText(formatTeamRoster(teams));
      setCopyStatus("Teams copied! Ready to paste into the group chat.");
    } catch {
      setCopyStatus("Couldn’t copy automatically. You can select the roster below and copy it.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Organiser view</p>
        <h1 className="text-3xl font-bold text-rose-700">Quiz teams</h1>
        {ready && <p className="text-sm text-gray-600">{playerCount} players · {teams.length} teams</p>}
      </header>
      <AdminNav active="teams" />
      <TeamsStatus loading={loading} error={error} empty={teams.length === 0} retry={retry} />
      {ready && (
        <>
          <TeamRoster teams={teams} />
          <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5">
            <h2 className="font-semibold text-rose-700">Tell the crew</h2>
            <p className="text-sm text-gray-600">Copy the teams into your group chat. Guests can also find their crew in the Teams tab.</p>
            <button type="button" onClick={copyRoster} className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500">Copy team list</button>
            <p role="status" className="text-sm text-rose-700">{copyStatus}</p>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-rose-50 p-4 font-sans text-sm leading-relaxed text-gray-700">{formatTeamRoster(teams)}</pre>
          </section>
        </>
      )}
    </main>
  );
}

export default function AdminTeamsPage() {
  return <AdminGate><TeamsOverview /></AdminGate>;
}
