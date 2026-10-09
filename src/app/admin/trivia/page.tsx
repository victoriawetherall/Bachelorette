"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import Leaderboard from "@/components/trivia/Leaderboard";
import { triviaRequest, useTrivia } from "@/lib/trivia/client";
import { FEUD_QUESTIONS } from "@/lib/trivia/questions";
import type { HostSnapshot } from "@/lib/trivia/types";

function TeamNames({
  names,
  save,
  busy,
}: {
  names: string[];
  save: (action: string, value: unknown) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(names);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          "teams",
          draft.map((n) => n.trim()),
        );
      }}
    >
      <h2 className="text-lg font-bold text-rose-800">Name your four teams</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {draft.map((name, index) => (
          <label key={index} className="text-sm font-semibold">
            Team {index + 1}
            <input
              className="trivia-input mt-1"
              required
              maxLength={40}
              value={name}
              onChange={(e) =>
                setDraft(
                  draft.map((n, i) => (i === index ? e.target.value : n)),
                )
              }
            />
          </label>
        ))}
      </div>
      <button disabled={busy} className="trivia-secondary">
        Save team names
      </button>
    </form>
  );
}

export default function TriviaHostPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [roundName, setRoundName] = useState("");
  const [roundMax, setRoundMax] = useState("10");
  const { data, error, refresh } = useTrivia<HostSnapshot>(
    "/api/trivia/host",
    unlocked,
  );
  useEffect(() => {
    let stopped = false;
    triviaRequest<HostSnapshot>("/api/trivia/host")
      .then(() => {
        if (!stopped) setUnlocked(true);
      })
      .catch(() => {
        /* The login form handles an expired/missing host session. */
      })
      .finally(() => {
        if (!stopped) setChecking(false);
      });
    return () => {
      stopped = true;
    };
  }, []);

  async function action(name: string, value?: unknown) {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await triviaRequest("/api/trivia/host", { action: name, value });
      await refresh();
      setMessage("Saved.");
      if (name === "add_round") setRoundName("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }
  async function login() {
    setBusy(true);
    setActionError(null);
    try {
      await triviaRequest("/api/trivia/host", { action: "login", password });
      setPassword("");
      setUnlocked(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't unlock.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await triviaRequest("/api/trivia/host", { action: "logout" });
      setUnlocked(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't sign out.");
    }
  }

  if (checking)
    return (
      <main className="p-10 text-center" role="status">
        Opening the host booth…
      </main>
    );
  if (!unlocked)
    return (
      <main className="mx-auto max-w-md space-y-6 px-4 py-12">
        <AdminNav active="trivia" />
        <header className="text-center">
          <p className="trivia-eyebrow">Organiser only</p>
          <h1 className="mt-2 text-3xl font-bold text-rose-800">
            The host booth 🎤
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Unlock the guest results and games-night controls.
          </p>
        </header>
        <form
          className="trivia-card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label className="block text-sm font-semibold">
            Trivia host password
            <input
              className="trivia-input mt-2"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy} className="trivia-primary w-full">
            {busy ? "Unlocking…" : "Unlock host controls"}
          </button>
          {actionError ? (
            <p role="alert" className="trivia-error">
              {actionError}
            </p>
          ) : null}
        </form>
        <Link
          href="/trivia"
          className="block text-center text-sm text-rose-700 underline"
        >
          Back to guest trivia
        </Link>
      </main>
    );

  const session = data?.session;
  const questions = data?.questions ?? FEUD_QUESTIONS;
  const question = session ? questions[session.question_index] : null;
  const activeRound = data?.rounds.find(
    (r) => r.id === session?.active_round_id,
  );
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <AdminNav active="trivia" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="trivia-eyebrow">Liv's last disco</p>
          <h1 className="mt-2 text-3xl font-bold text-rose-800">
            The host booth 🎤
          </h1>
        </div>
        <button className="trivia-secondary" onClick={() => void logout()}>
          Lock host booth
        </button>
      </header>
      <section className="rounded-2xl bg-violet-100 p-5 text-violet-950">
        <p className="font-bold">Your Zoom setup</p>
        <p className="mt-2 text-sm">
          Open the presentation in a separate window and share that window on
          Zoom. Keep this host booth on your own screen: it contains the
          answers.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/present/trivia"
            target="_blank"
            rel="noopener noreferrer"
            className="trivia-primary"
          >
            Open presentation ↗
          </a>
          <a
            href="/images/trivia-zoom-background.png"
            download
            className="trivia-secondary"
          >
            Download Zoom background
          </a>
        </div>
      </section>
      {error || actionError ? (
        <p role="alert" className="trivia-error">
          {actionError ?? error}
          <button onClick={() => void refresh()} className="ml-2 underline">
            Retry
          </button>
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {!data || !session || !question ? (
        <p role="status">Loading the saved game…</p>
      ) : (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <section className="trivia-card space-y-4">
                <h2 className="text-lg font-bold text-rose-800">
                  1. Collect the secret votes
                </h2>
                <p className="text-sm text-gray-600">
                  Send guests the app's{" "}
                  <Link
                    className="font-semibold text-rose-600 underline"
                    href="/trivia"
                  >
                    Trivia tab
                  </Link>
                  . Each person answers independently before the party. Keep Liv
                  away from the survey so she can guess on the night.
                </p>
                <p className="text-3xl font-bold text-rose-700">
                  {data.response_count}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    guest responses ·{" "}
                    {session.survey_open ? "voting open" : "voting closed"}
                  </span>
                </p>
                <button
                  disabled={
                    busy || (session.survey_open && data.response_count === 0)
                  }
                  className="trivia-primary"
                  onClick={() =>
                    void action(
                      session.survey_open ? "close_survey" : "open_survey",
                    )
                  }
                >
                  {session.survey_open
                    ? "Close voting & start playing"
                    : "Reopen voting"}
                </button>
                <p className="text-xs text-gray-500">
                  Voting cannot reopen once teams start predicting, so the
                  results stay fair.
                </p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-rose-700">
                    Who has voted?
                  </summary>
                  <p className="mt-2 text-sm text-gray-600">
                    {data.respondents.join(", ") || "No responses yet."}
                  </p>
                </details>
              </section>
              <section className="trivia-card space-y-5">
                <h2 className="text-lg font-bold text-rose-800">
                  2. Run the rounds
                </h2>
                <label className="block text-sm font-semibold">
                  Active round
                  <select
                    className="trivia-input mt-2"
                    value={session.active_round_id ?? ""}
                    disabled={busy}
                    onChange={(e) => void action("round", e.target.value)}
                  >
                    {data.rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {activeRound?.kind === "family_feud" ? (
                  <>
                    <label className="block text-sm font-semibold">
                      Family Feud question
                      <select
                        className="trivia-input mt-2"
                        value={session.question_index}
                        disabled={busy}
                        onChange={(e) =>
                          void action("question", Number(e.target.value))
                        }
                      >
                        {questions.map((q, index) => (
                          <option key={q.id} value={index}>
                            {index + 1}. {q.prompt}
                          </option>
                        ))}
                      </select>
                    </label>
                    <h3 className="text-xl font-bold">{question.prompt}</h3>
                    <p className="text-sm text-gray-600">
                      Let teams submit their prediction on their phones, then
                      ask Liv to guess the most popular answer. Reveal it to
                      award 10 points automatically to every correct team.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {session.team_names.map((name, i) => (
                        <p
                          key={i}
                          className={`rounded-xl p-3 text-xs font-semibold ${data.prediction_teams.includes(i + 1) ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
                        >
                          {data.prediction_teams.includes(i + 1) ? "✓" : "…"}{" "}
                          {name}
                        </p>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={
                          busy ||
                          session.survey_open ||
                          session.revealed_count >= question.options.length
                        }
                        className="trivia-primary"
                        onClick={() =>
                          void action("reveal", session.revealed_count + 1)
                        }
                      >
                        {session.revealed_count === 0
                          ? "Reveal top answer & score teams"
                          : "Reveal next answer"}
                      </button>
                      <button
                        disabled={
                          busy ||
                          session.survey_open ||
                          session.revealed_count >= question.options.length
                        }
                        className="trivia-secondary"
                        onClick={() =>
                          void action("reveal", question.options.length)
                        }
                      >
                        Reveal all
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button
                        disabled={busy || session.question_index === 0}
                        className="trivia-secondary flex-1"
                        onClick={() =>
                          void action("question", session.question_index - 1)
                        }
                      >
                        ← Previous
                      </button>
                      <button
                        disabled={
                          busy ||
                          session.question_index === questions.length - 1
                        }
                        className="trivia-secondary flex-1"
                        onClick={() =>
                          void action("question", session.question_index + 1)
                        }
                      >
                        Next →
                      </button>
                    </div>
                    <details className="rounded-xl border border-violet-200 p-3">
                      <summary className="cursor-pointer text-sm font-bold text-violet-900">
                        Host-only answer key
                      </summary>
                      <ol className="mt-3 space-y-2">
                        {data.results[session.question_index]?.map((answer) => (
                          <li
                            key={answer.option}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <span>
                              {answer.rank}. {answer.option}
                            </span>
                            <strong className="shrink-0">
                              {answer.votes} votes
                            </strong>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    Run this round over Zoom, announce the answers, then ask
                    each team's captain to enter their round score in Play. Each
                    team can score up to {activeRound?.max_points} points.
                  </p>
                )}
              </section>
            </div>
            <div className="space-y-6">
              <Leaderboard data={data} />
              <section className="trivia-card">
                <TeamNames
                  key={session.team_names.join("|")}
                  names={session.team_names}
                  save={action}
                  busy={busy}
                />
              </section>
              <form
                className="trivia-card space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("add_round", {
                    name: roundName.trim(),
                    max_points: Number(roundMax),
                  });
                }}
              >
                <h2 className="text-lg font-bold text-rose-800">
                  Add the next round
                </h2>
                <label className="block text-sm font-semibold">
                  Round name
                  <input
                    className="trivia-input mt-1"
                    required
                    maxLength={60}
                    placeholder="e.g. Guess the throwback"
                    value={roundName}
                    onChange={(e) => setRoundName(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Maximum points
                  <input
                    className="trivia-input mt-1"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    required
                    value={roundMax}
                    onChange={(e) => setRoundMax(e.target.value)}
                  />
                </label>
                <button className="trivia-secondary" disabled={busy}>
                  Add round
                </button>
                <p className="text-xs text-gray-500">
                  Then select it as the active round. Team totals carry across
                  all rounds.
                </p>
              </form>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
