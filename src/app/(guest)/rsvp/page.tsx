"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useGuest } from "@/lib/useGuest";
import { insforge, type PaymentStatus, type Rsvp, type Session } from "@/lib/insforge";

const CONFIRMATIONS = [
  "🎉 You're locked in! Liv is going to cry (happy tears, we hope) when she sees this list.",
  "💃 RSVP secured! Somewhere, Liv just felt a mysterious urge to start a group chat.",
  "🥂 Boom, you're on the list! Liv owes you a drink already — she just doesn't know it yet.",
  "✨ RSVP received! May your weekend be full of chaos, love, and zero lost shoes.",
];

type DietaryKey =
  | "dietary_vegetarian"
  | "dietary_vegan"
  | "dietary_gluten_free"
  | "dietary_other";

const DIETARY_OPTIONS: { key: DietaryKey; label: string }[] = [
  { key: "dietary_vegetarian", label: "Vegetarian" },
  { key: "dietary_vegan", label: "Vegan" },
  { key: "dietary_gluten_free", label: "Gluten-free" },
  { key: "dietary_other", label: "Other" },
];

export default function RsvpPage() {
  const guest = useGuest();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [rsvpId, setRsvpId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null
  );
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
    new Set()
  );
  const [dietary, setDietary] = useState<Record<DietaryKey, boolean>>({
    dietary_vegetarian: false,
    dietary_vegan: false,
    dietary_gluten_free: false,
    dietary_other: false,
  });
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [drinksAlcohol, setDrinksAlcohol] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmation] = useState(
    () => CONFIRMATIONS[Math.floor(Math.random() * CONFIRMATIONS.length)]
  );

  useEffect(() => {
    if (!guest) return;

    async function load() {
      setLoading(true);
      setError(null);

      const [{ data: sessionData, error: sessionError }, { data: rsvpData, error: rsvpError }] =
        await Promise.all([
          insforge.database
            .from("sessions")
            .select("id, label, active, sort_order")
            .eq("active", true)
            .order("sort_order", { ascending: true }),
          insforge.database
            .from("rsvps")
            .select("*, rsvp_sessions(session_id)")
            .eq("guest_id", guest!.id)
            .maybeSingle(),
        ]);

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      setSessions((sessionData as Session[]) ?? []);

      if (rsvpError) {
        setError(rsvpError.message);
        setLoading(false);
        return;
      }

      const rsvp = rsvpData as Rsvp | null;
      if (rsvp) {
        setRsvpId(rsvp.id);
        setPaymentStatus(rsvp.payment_status);
        setDietary({
          dietary_vegetarian: rsvp.dietary_vegetarian,
          dietary_vegan: rsvp.dietary_vegan,
          dietary_gluten_free: rsvp.dietary_gluten_free,
          dietary_other: rsvp.dietary_other,
        });
        setDietaryNotes(rsvp.dietary_notes ?? "");
        setDrinksAlcohol(rsvp.drinks_alcohol);
        setSelectedSessions(
          new Set((rsvp.rsvp_sessions ?? []).map((row) => row.session_id))
        );
      }

      setLoading(false);
    }

    void load();
  }, [guest]);

  const isEditing = useMemo(() => rsvpId !== null, [rsvpId]);

  function toggleSession(sessionId: string) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  function toggleDietary(key: DietaryKey) {
    setDietary((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guest) return;

    setSubmitting(true);
    setError(null);

    const values = {
      ...dietary,
      dietary_notes: dietaryNotes.trim() || null,
      drinks_alcohol: drinksAlcohol,
      submitted_at: new Date().toISOString(),
    };

    let currentRsvpId = rsvpId;

    if (currentRsvpId) {
      const { error: updateError } = await insforge.database
        .from("rsvps")
        .update(values)
        .eq("id", currentRsvpId);

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }

      const { error: deleteError } = await insforge.database
        .from("rsvp_sessions")
        .delete()
        .eq("rsvp_id", currentRsvpId);

      if (deleteError) {
        setError(deleteError.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { data: inserted, error: insertError } = await insforge.database
        .from("rsvps")
        .insert({ guest_id: guest.id, ...values })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        setSubmitting(false);
        return;
      }

      currentRsvpId = (inserted as Rsvp).id;
      setRsvpId(currentRsvpId);
      setPaymentStatus((inserted as Rsvp).payment_status);
    }

    if (selectedSessions.size > 0) {
      const rows = Array.from(selectedSessions).map((sessionId) => ({
        rsvp_id: currentRsvpId,
        session_id: sessionId,
      }));

      const { error: sessionInsertError } = await insforge.database
        .from("rsvp_sessions")
        .insert(rows);

      if (sessionInsertError) {
        setError(sessionInsertError.message);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    setJustSubmitted(true);
  }

  if (loading) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
          RSVP
        </p>
        <h1 className="text-2xl font-bold text-rose-700">
          {guest ? `Hey ${guest.name} 💌` : "RSVP"}
        </h1>
        {paymentStatus && (
          <p>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                paymentStatus === "paid"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {paymentStatus === "paid" ? "Paid ✅" : "Unpaid"}
            </span>
          </p>
        )}
      </header>

      {justSubmitted && (
        <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-700">{confirmation}</p>
          <button
            type="button"
            onClick={() => setJustSubmitted(false)}
            className="text-sm font-medium text-rose-500 hover:text-rose-700"
          >
            Edit your RSVP
          </button>
        </section>
      )}

      {!justSubmitted && (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              What are you coming to?
            </h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <label
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl border border-rose-100 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(session.id)}
                    onChange={() => toggleSession(session.id)}
                    className="h-4 w-4 rounded border-rose-300 text-rose-500 focus:ring-rose-300"
                  />
                  {session.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Dietary needs
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={dietary[option.key]}
                    onChange={() => toggleDietary(option.key)}
                    className="h-4 w-4 rounded border-rose-300 text-rose-500 focus:ring-rose-300"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <textarea
              value={dietaryNotes}
              onChange={(event) => setDietaryNotes(event.target.value)}
              rows={2}
              placeholder="Anything else we should know? (specifics of an allergy, etc.)"
              className="mt-2 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Drinks</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDrinksAlcohol(true)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  drinksAlcohol
                    ? "bg-rose-500 text-white"
                    : "border border-rose-200 text-gray-600"
                }`}
              >
                Drinking 🍷
              </button>
              <button
                type="button"
                onClick={() => setDrinksAlcohol(false)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  !drinksAlcohol
                    ? "bg-rose-500 text-white"
                    : "border border-rose-200 text-gray-600"
                }`}
              >
                Not drinking 🙅
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEditing ? "Update RSVP" : "Submit RSVP"}
          </button>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
