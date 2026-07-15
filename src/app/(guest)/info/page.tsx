"use client";

import { useGuest } from "@/lib/useGuest";

export default function InfoPage() {
  const guest = useGuest();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
          The Weekend
        </p>
        <h1 className="text-2xl font-bold text-rose-700">
          {guest ? `Hey ${guest.name}, here's the plan! 🎉` : "Here's the plan! 🎉"}
        </h1>
      </header>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-rose-700">📅 When</h2>
        <p className="text-sm text-gray-700">
          Friday 9th – Sunday 11th October. Come for the whole thing or just
          part of it — let us know on the RSVP page.
        </p>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-rose-700">📍 Where</h2>
        <p className="text-sm text-gray-700">
          An Airbnb a couple of hours out of Melbourne — the exact spot is
          still being locked in! We&rsquo;ll update this page the second
          it&rsquo;s booked, so check back closer to the date.
        </p>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-rose-700">
          🗓️ The rundown
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>
            <span className="font-semibold">Friday night</span> — Games night 🎲
          </li>
          <li>
            <span className="font-semibold">Saturday</span> — The main event! 🍾
          </li>
          <li>
            <span className="font-semibold">Saturday night</span> — Party time! 💃
          </li>
          <li>
            <span className="font-semibold">Sunday morning</span> — Recovery breakfast ☀️
          </li>
        </ul>
        <p className="mt-3 text-xs italic text-gray-400">
          Still being finalised — more details coming soon.
        </p>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-rose-700">
          🎒 What to bring
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Comfy outfit for the drive</li>
          <li>Something fabulous for Saturday night</li>
          <li>PJs for the sleepover</li>
          <li>Sunnies + swimmers, just in case</li>
          <li>Your best (embarrassing) Liv stories</li>
          <li>An open mind for whatever the bridesmaids have planned 👀</li>
        </ul>
      </section>
    </main>
  );
}
