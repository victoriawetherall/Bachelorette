"use client";

import { useState } from "react";
import { useTrivia } from "@/lib/trivia/client";
import { FEUD_QUESTIONS } from "@/lib/trivia/questions";
import Leaderboard from "@/components/trivia/Leaderboard";

export default function TriviaPresentationPage() {
  const { data, error, refresh } = useTrivia();
  const [leaderboardOnly, setLeaderboardOnly] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError(false);
    } catch {
      setFullscreenError(true);
    }
  }
  const questions = data?.questions ?? FEUD_QUESTIONS;
  const question = questions[data?.session.question_index ?? 0];
  const round = data?.rounds.find((r) => r.id === data.session.active_round_id);
  const feud = round?.kind === "family_feud";
  return (
    <main className="feud-stage min-h-screen px-5 py-6 text-white sm:px-10 sm:py-8">
      <header className="mx-auto mb-8 flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-300">
            Liv's last disco 🪩
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {feud ? "Family Feud" : "The Liv Quiz"}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold hover:bg-white/10"
            onClick={() => setLeaderboardOnly(!leaderboardOnly)}
          >
            {leaderboardOnly ? "Show game" : "Show leaderboard"}
          </button>
          <button
            className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold hover:bg-white/10"
            onClick={() => void fullscreen()}
          >
            Full screen
          </button>
        </div>
      </header>
      {error ? (
        <p
          role="alert"
          className="mx-auto mb-6 max-w-7xl rounded-xl bg-red-950 p-4 text-sm text-red-100"
        >
          {error} {data ? "Displayed scores may be out of date." : null}
          <button className="ml-2 underline" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      ) : null}
      {fullscreenError ? (
        <p role="status" className="mb-4 text-center text-sm text-pink-200">
          Full screen isn't available here. Maximise this window for Zoom.
        </p>
      ) : null}
      {!data ? (
        <div className="mx-auto max-w-3xl py-24 text-center">
          <p className="text-7xl">🪩</p>
          <h2 className="mt-8 text-5xl font-bold">
            How well does Liv know us?
          </h2>
          <p className="mt-6 text-lg text-pink-200">
            {error
              ? "The host is getting the saved game ready."
              : "Connecting to games night…"}
          </p>
        </div>
      ) : leaderboardOnly ? (
        <div className="mx-auto max-w-3xl py-12">
          <h2 className="mb-8 text-center text-4xl font-bold">
            Tonight's legends ✨
          </h2>
          <Leaderboard data={data} dark />
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl items-start gap-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-6">
            {data.session.survey_open ? (
              <div className="rounded-3xl border border-pink-300/20 bg-white/5 px-6 py-16 text-center">
                <p className="text-6xl">💭</p>
                <h2 className="mt-6 text-4xl font-bold sm:text-5xl">
                  Liv, according to us
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pink-100">
                  We asked the guests. Now Liv gets to guess what her friends
                  really think.
                </p>
                <p className="mt-8 text-sm text-pink-300">
                  Four teams · {questions.length} questions · 10 points for a
                  top answer
                </p>
              </div>
            ) : feud ? (
              <>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-pink-300">
                    Question {data.session.question_index + 1} /{" "}
                    {questions.length} · {data.response_count} guests surveyed
                  </p>
                  <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl xl:text-5xl">
                    {question.prompt}
                  </h2>
                  <p className="mt-4 text-lg text-pink-200">
                    Liv, which answer got the most votes?
                  </p>
                </div>
                <ol className="space-y-3">
                  {question.options.map((_, index) => {
                    const revealed = data.revealed_answers[index];
                    return (
                      <li
                        key={`${question.id}:${index}`}
                        className={`flex min-h-16 items-center gap-4 rounded-2xl border px-5 py-3 sm:min-h-20 ${revealed ? "border-pink-300/60 bg-pink-300 text-[#321732]" : "border-white/15 bg-white/5"}`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${revealed ? "bg-[#321732]/10" : "bg-white/10 text-pink-200"}`}
                        >
                          {revealed?.rank ?? index + 1}
                        </span>
                        <span className="flex-1 text-lg font-bold sm:text-xl">
                          {revealed?.option ?? "✦ ✦ ✦"}
                        </span>
                        {revealed ? (
                          <span className="text-right">
                            <strong className="text-2xl tabular-nums">
                              {revealed.votes}
                            </strong>
                            <span className="ml-2 text-xs">votes</span>
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
                {data.session.revealed_count === 0 ? (
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-pink-300">
                      The contenders
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((option) => (
                        <span
                          key={option}
                          className="rounded-full border border-white/15 px-3 py-2 text-sm text-pink-100"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-pink-300">
                      {data.prediction_teams.length}/4 teams have submitted a
                      prediction
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-pink-200">
                    Correct top-answer predictions earn 10 points. Tied top
                    answers both count.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-20 text-center">
                <p className="text-sm uppercase tracking-widest text-pink-300">
                  Next up
                </p>
                <h2 className="mt-6 text-4xl font-bold sm:text-5xl">
                  {round?.name ?? "Games night"}
                </h2>
                <p className="mt-6 text-lg text-pink-100">
                  Your host will take it from here. Team captains, enter your
                  round scores in the app.
                </p>
              </div>
            )}
          </section>
          <aside className="space-y-5">
            <Leaderboard data={data} dark />
            <p className="px-4 text-center text-xs leading-relaxed text-pink-200">
              Captains: open Trivia → Play on your phone.
              <br />
              One submission per team.
            </p>
          </aside>
        </div>
      )}
      <footer className="mx-auto mt-10 max-w-7xl text-center text-xs uppercase tracking-[0.2em] text-pink-300/60">
        Made with love, for Liv · October 9–11
      </footer>
    </main>
  );
}
