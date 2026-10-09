"use client";

import { useState } from "react";
import { claimCaptain, type Captain } from "@/lib/liveQuiz";

export default function QuizCaptain({ captain, guestId, isLiv, refresh }: {
  captain: Captain | undefined; guestId: string | undefined; isLiv: boolean; refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function claim() {
    if (!guestId || busy) return;
    setBusy(true); setError(null);
    try { await claimCaptain(guestId); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t choose your captain."); refresh(); }
    finally { setBusy(false); }
  }
  if (!captain) return null;
  return <section className="space-y-2 rounded-2xl border border-rose-200 bg-white p-4">
    <h2 className="font-bold text-rose-800">One team, one answer</h2>
    <p className="text-sm text-gray-700">{captain.guest_id
      ? captain.guest_id === guestId ? "You’re the captain. Talk it through together, then submit your team’s answer." : `${captain.name} is your captain and submits the team’s answer. You’ll see it here.`
      : "Choose one captain for the three team rounds. Harry can change your captain if needed."}</p>
    {!captain.guest_id && !isLiv && guestId && <button type="button" disabled={busy} onClick={() => void claim()} className="rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : "I’ll be our captain"}</button>}
    {!captain.guest_id && isLiv && <p className="text-sm text-rose-700">Ask a teammate to captain: you’ll answer the Ben questions live!</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
