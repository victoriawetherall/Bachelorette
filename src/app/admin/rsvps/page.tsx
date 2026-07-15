"use client";

import { FormEvent, useEffect, useState } from "react";
import { insforge, type Guest, type Rsvp, type Session } from "@/lib/insforge";
import { isAdminUnlocked, unlockAdmin } from "@/lib/adminAuth";

const DIETARY_LABELS: {
  key: "dietary_vegetarian" | "dietary_vegan" | "dietary_gluten_free" | "dietary_other";
  label: string;
}[] = [
  { key: "dietary_vegetarian", label: "Vegetarian" },
  { key: "dietary_vegan", label: "Vegan" },
  { key: "dietary_gluten_free", label: "Gluten-free" },
  { key: "dietary_other", label: "Other" },
];

export default function AdminRsvpsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnlocked(isAdminUnlocked());
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    async function load() {
      setLoading(true);
      setError(null);

      const [
        { data: guestData, error: guestError },
        { data: sessionData, error: sessionError },
        { data: rsvpData, error: rsvpError },
      ] = await Promise.all([
        insforge.database
          .from("guests")
          .select("id, name, created_at")
          .order("name", { ascending: true }),
        insforge.database
          .from("sessions")
          .select("id, label, active, sort_order")
          .order("sort_order", { ascending: true }),
        insforge.database.from("rsvps").select("*, rsvp_sessions(session_id)"),
      ]);

      const firstError = guestError ?? sessionError ?? rsvpError;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setGuests((guestData as Guest[]) ?? []);
      setSessions((sessionData as Session[]) ?? []);
      setRsvps((rsvpData as Rsvp[]) ?? []);
      setLoading(false);
    }

    void load();
  }, [unlocked]);

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordInput === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      unlockAdmin();
      setUnlocked(true);
      setAuthError(null);
    } else {
      setAuthError("Wrong password.");
    }
  }

  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-center text-2xl font-bold text-rose-700">
          Organiser login
        </h1>
        <form
          onSubmit={handleUnlock}
          className="space-y-4 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm"
        >
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Unlock
          </button>
          {authError && (
            <p className="text-center text-sm text-red-600">{authError}</p>
          )}
        </form>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      </main>
    );
  }

  const guestsById = new Map(guests.map((guest) => [guest.id, guest]));
  const respondedGuestIds = new Set(rsvps.map((rsvp) => rsvp.guest_id));
  const notResponded = guests.filter((guest) => !respondedGuestIds.has(guest.id));

  const activeSessions = sessions
    .filter((session) => session.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const rows = rsvps
    .map((rsvp) => {
      const guestName = guestsById.get(rsvp.guest_id)?.name ?? "Unknown guest";
      const sessionIds = new Set(
        (rsvp.rsvp_sessions ?? []).map((row) => row.session_id)
      );
      const hasDietaryNeeds = DIETARY_LABELS.some(({ key }) => rsvp[key]);

      return { rsvp, guestName, sessionIds, hasDietaryNeeds };
    })
    .sort((a, b) => a.guestName.localeCompare(b.guestName));

  const sessionCounts = activeSessions.map(
    (session) => rows.filter((row) => row.sessionIds.has(session.id)).length
  );
  const dietaryCount = rows.filter((row) => row.hasDietaryNeeds).length;
  const alcoholCount = rows.filter((row) => row.rsvp.drinks_alcohol).length;
  const paidCount = rows.filter(
    (row) => row.rsvp.payment_status === "paid"
  ).length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-rose-700">RSVPs</h1>
        <p className="text-sm text-gray-500">
          {rsvps.length} of {guests.length} guests have RSVP&rsquo;d
        </p>
      </header>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-rose-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="divide-x divide-rose-100 border-b border-rose-200 bg-rose-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Guest</th>
                {activeSessions.map((session) => (
                  <th key={session.id} className="px-4 py-3 text-center">
                    {session.label}
                  </th>
                ))}
                <th className="px-4 py-3">Dietary</th>
                <th className="px-4 py-3 text-center">Alcohol</th>
                <th className="px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100">
              {rows.map(({ rsvp, guestName, sessionIds }) => (
                <tr key={rsvp.id} className="divide-x divide-rose-100">
                  <td className="px-4 py-3 font-semibold text-rose-700">
                    {guestName}
                  </td>
                  {activeSessions.map((session) => (
                    <td
                      key={session.id}
                      className="px-4 py-3 text-center text-gray-700"
                    >
                      {sessionIds.has(session.id) ? "✓" : ""}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-700">
                    {DIETARY_LABELS.filter(({ key }) => rsvp[key])
                      .map(({ label }) => label)
                      .join(", ") || "None"}
                    {rsvp.dietary_notes ? ` — ${rsvp.dietary_notes}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {rsvp.drinks_alcohol ? "✓" : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        rsvp.payment_status === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {rsvp.payment_status === "paid" ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="divide-x divide-rose-100 border-t-2 border-rose-200 bg-rose-50 text-sm font-semibold text-gray-700">
                <td className="px-4 py-3">Total</td>
                {sessionCounts.map((count, index) => (
                  <td
                    key={activeSessions[index].id}
                    className="px-4 py-3 text-center"
                  >
                    {count}
                  </td>
                ))}
                <td className="px-4 py-3">{dietaryCount}</td>
                <td className="px-4 py-3 text-center">{alcoholCount}</td>
                <td className="px-4 py-3">{paidCount} paid</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400">No RSVPs yet.</p>
      )}

      {notResponded.length > 0 && (
        <section className="mt-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Haven&rsquo;t RSVP&rsquo;d yet
          </p>
          <div className="overflow-x-auto rounded-2xl border border-dashed border-gray-300 bg-white">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                {notResponded.map((guest) => (
                  <tr key={guest.id}>
                    <td className="px-4 py-3 text-gray-700">{guest.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
