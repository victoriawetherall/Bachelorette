"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge, type Guest } from "@/lib/insforge";
import {
  clearStoredGuest,
  getStoredGuest,
  setStoredGuest,
  type GuestIdentity,
} from "@/lib/identity";

export default function LandingPage() {
  const router = useRouter();
  const [returningGuest, setReturningGuest] = useState<GuestIdentity | null>(
    null
  );
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGuests = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await insforge.database
      .from("guests")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setGuests((data as Guest[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = getStoredGuest();
    if (stored) {
      setReturningGuest(stored);
      setLoading(false);
      return;
    }

    void loadGuests();
  }, [loadGuests]);

  function handleContinue() {
    router.push("/info");
  }

  function handleNotYou() {
    clearStoredGuest();
    setReturningGuest(null);
    void loadGuests();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const guest = guests.find((item) => item.id === selectedId);
    if (!guest) return;

    setStoredGuest({ id: guest.id, name: guest.name });
    router.push("/info");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <header className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
          October 9–11
        </p>
        <h1 className="text-3xl font-bold text-rose-700">
          Liv&rsquo;s Bachelorette Weekend 🎉
        </h1>
      </header>

      {returningGuest ? (
        <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-700">
            Welcome back, {returningGuest.name}! 👋
          </p>
          <button
            type="button"
            onClick={handleContinue}
            className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={handleNotYou}
            className="text-sm font-medium text-gray-400 hover:text-rose-500"
          >
            Not you?
          </button>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="guest"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Who&rsquo;s this?
            </label>
            <select
              id="guest"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={loading || guests.length === 0}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
            >
              <option value="" disabled>
                {loading ? "Loading names…" : "Pick your name"}
              </option>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!selectedId}
            className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Let&rsquo;s go →
          </button>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              Couldn&rsquo;t load the guest list: {error}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
