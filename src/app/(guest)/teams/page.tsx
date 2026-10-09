"use client";

import Link from "next/link";
import TeamRoster from "@/components/TeamRoster";
import TeamsStatus from "@/components/TeamsStatus";
import { useGuest } from "@/lib/useGuest";
import { useQuizTeams } from "@/lib/useQuizTeams";

export default function TeamsPage() {
  const guest = useGuest();
  const { teams, loading, error, retry } = useQuizTeams();
  const yourTeam = teams.find((team) =>
    team.quiz_team_members.some((member) => member.guest_id === guest?.id)
  );
  const ready = !loading && !error && teams.length > 0;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">Liv&rsquo;s hens quiz</p>
        <h1 className="text-3xl font-bold text-rose-700">Meet your quiz crew 🎉</h1>
        <p className="text-sm text-gray-600">Four teams. One bride. Bragging rights up for grabs.</p>
      </header>

      <TeamsStatus loading={loading} error={error} empty={teams.length === 0} retry={retry} />

      {ready && guest && (
        <div className="rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-sm">
          {yourTeam ? (
            <>
              <p className="text-xl font-bold text-rose-700">You&rsquo;re on {yourTeam.name}, {guest.name}!</p>
              <p className="mt-2 text-sm text-gray-600">Find your teammates below and get ready to cheer each other on.</p>
            </>
          ) : (
            <p className="text-sm text-gray-600">You haven&rsquo;t been assigned a quiz team. Check with Harry or Vic.</p>
          )}
          <Link href="/" className="mt-3 inline-block rounded text-sm font-medium text-rose-600 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500">
            Not {guest.name}? Change your name
          </Link>
        </div>
      )}

      {ready && <TeamRoster teams={teams} guestId={guest?.id} />}
    </main>
  );
}
