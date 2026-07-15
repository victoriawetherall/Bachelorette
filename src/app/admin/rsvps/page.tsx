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
          Organizer login
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
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const respondedGuestIds = new Set(rsvps.map((rsvp) => rsvp.guest_id));
  const notResponded = guests.filter((guest) => !respondedGuestIds.has(guest.id));

  const rows = rsvps
    .map((rsvp) => {
      const guestName = guestsById.get(rsvp.guest_id)?.name ?? "Unknown guest";
      const sessionLabels = (rsvp.rsvp_sessions ?? [])
        .map((row) => sessionsById.get(row.session_id))
        .filter((session): session is Session => Boolean(session))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((session) => session.label);

      return { rsvp, guestName, sessionLabels };
    })
    .sort((a, b) => a.guestName.localeCompare(b.guestName));

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-rose-700">RSVPs</h1>
        <p className="text-sm text-gray-500">
          {rsvps.length} of {guests.length} guests have RSVP&rsquo;d
        </p>
      </header>

      <div className="space-y-4">
        {rows.map(({ rsvp, guestName, sessionLabels }) => (
          <article
            key={rsvp.id}
            className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-rose-700">
                {guestName}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  rsvp.payment_status === "paid"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {rsvp.payment_status === "paid" ? "Paid" : "Unpaid"}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Attending
              </p>
              <p className="text-sm text-gray-700">
                {sessionLabels.length > 0
                  ? sessionLabels.join(", ")
                  : "No sessions selected"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Dietary
              </p>
              <p className="text-sm text-gray-700">
                {DIETARY_LABELS.filter(({ key }) => rsvp[key])
                  .map(({ label }) => label)
                  .join(", ") || "None"}
                {rsvp.dietary_notes ? ` — ${rsvp.dietary_notes}` : ""}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Drinks
              </p>
              <p className="text-sm text-gray-700">
                {rsvp.drinks_alcohol ? "Drinks alcohol" : "Non-drinker"}
              </p>
            </div>
          </article>
        ))}

        {rows.length === 0 && (
          <p className="text-center text-sm text-gray-400">No RSVPs yet.</p>
        )}
      </div>

      {notResponded.length > 0 && (
        <section className="mt-8 rounded-2xl border border-dashed border-gray-300 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Haven&rsquo;t RSVP&rsquo;d yet
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {notResponded.map((guest) => guest.name).join(", ")}
          </p>
        </section>
      )}
    </main>
  );
}
