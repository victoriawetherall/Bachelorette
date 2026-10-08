"use client";

import { useState } from "react";
import { useGuest } from "@/lib/useGuest";
import { useTrivia } from "@/lib/trivia/client";
import Survey from "@/components/trivia/Survey";
import TeamPlay from "@/components/trivia/TeamPlay";
import Leaderboard from "@/components/trivia/Leaderboard";

export default function TriviaPage() {
  const guest = useGuest();
  const { data, error, loading, refresh } = useTrivia();
  const [view, setView] = useState("survey");
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="text-center">
        <p className="trivia-eyebrow">Liv's last disco · games night</p>
        <h1 className="mt-2 text-4xl font-bold text-rose-800">
          The Liv Quiz 🪩
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          A little friendly competition. A lot of Liv.
        </p>
      </header>
      <div
        className="flex rounded-full border border-rose-200 bg-white p-1"
        role="group"
        aria-label="Trivia views"
      >
        {[
          ["survey", "Secret survey"],
          ["play", "Play"],
          ["scores", "Leaderboard"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`min-h-11 flex-1 rounded-full px-2 text-sm font-semibold ${view === id ? "bg-rose-500 text-white" : "text-gray-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <div role="alert" className="trivia-error">
          {error} {data ? "The board below may be out of date." : null}
          <button
            onClick={() => void refresh()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      {loading ? (
        <p role="status" className="py-8 text-center text-gray-500">
          Getting games night ready…
        </p>
      ) : null}
      {guest && data ? (
        <>
          {view === "survey" ? (
            <Survey
              key={data.session.question_set_version}
              guest={guest}
              open={data.session.survey_open}
              questions={data.questions}
              questionSetVersion={data.session.question_set_version}
            />
          ) : view === "play" ? (
            <TeamPlay data={data} guest={guest} refresh={refresh} />
          ) : (
            <>
              <Leaderboard data={data} />
              <section className="trivia-card space-y-3">
                <h2 className="font-bold text-rose-800">Round by round</h2>
                {data.rounds.map((round) => (
                  <div key={round.id} className="border-t border-rose-100 pt-3">
                    <h3 className="text-sm font-semibold">{round.name}</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {data.session.team_names.map((name, i) => (
                        <p key={i}>
                          {name}:{" "}
                          <strong>
                            {data.scores.find(
                              (s) =>
                                s.round_id === round.id && s.team === i + 1,
                            )?.points ?? "—"}
                          </strong>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
          <p role="status" className="text-center text-xs text-gray-500">
            {error
              ? "Connection interrupted · reconnecting"
              : "Connected · scores refresh every 2 seconds"}
          </p>
        </>
      ) : null}
    </main>
  );
}
