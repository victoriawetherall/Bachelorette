"use client";

import { useEffect, useState } from "react";
import type { GuestIdentity } from "@/lib/identity";
import { FEUD_QUESTIONS } from "@/lib/trivia/questions";
import { triviaRequest } from "@/lib/trivia/client";
import type { TriviaSnapshot } from "@/lib/trivia/types";

function Prediction({
  data,
  guest,
  team,
  refresh,
}: {
  data: TriviaSnapshot;
  guest: GuestIdentity;
  team: number;
  refresh: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [savedAnswer, setSavedAnswer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionIndex = data.session.question_index;
  const questions = data.questions ?? FEUD_QUESTIONS;
  const question = questions[questionIndex];
  const locked =
    data.session.revealed_count > 0 ||
    data.session.scored_questions.includes(questionIndex);
  useEffect(() => {
    let stopped = false;
    triviaRequest<{ answer_index: number | null }>(
      `/api/trivia/prediction?guest=${guest.id}&team=${team}&question=${questionIndex}`,
    )
      .then((value) => {
        if (!stopped) {
          setAnswer(value.answer_index);
          setSavedAnswer(value.answer_index);
        }
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [guest.id, team, questionIndex]);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await triviaRequest("/api/trivia/prediction", {
        guest_id: guest.id,
        team,
        question_index: questionIndex,
        answer_index: answer,
      });
      setSavedAnswer(answer);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="trivia-eyebrow">
        Question {questionIndex + 1} of {questions.length} · 10 points
      </p>
      <h3 className="text-xl font-bold">{question.prompt}</h3>
      <p className="text-sm text-gray-600">
        Which answer got the most guest votes? Agree as a team, then let one
        captain submit. Tied top answers both count.
      </p>
      <fieldset disabled={locked || busy || loading} className="space-y-2">
        <legend className="sr-only">Your team's prediction</legend>
        {question.options.map((option, index) => (
          <label
            key={option}
            className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 text-sm ${answer === index ? "border-rose-500 bg-rose-50" : "border-rose-100"}`}
          >
            <input
              type="radio"
              name="prediction"
              className="accent-rose-600"
              checked={answer === index}
              onChange={() => setAnswer(index)}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
      {locked ? (
        <p
          role="status"
          className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900"
        >
          Predictions locked.{" "}
          {savedAnswer === null
            ? "No prediction was submitted by this device's captain."
            : `Your saved prediction: ${question.options[savedAnswer]}.`}{" "}
          Scores update automatically when the answer is revealed.
        </p>
      ) : (
        <button
          className="trivia-primary w-full"
          disabled={answer === null || busy || loading}
          onClick={() => void save()}
        >
          {busy
            ? "Saving…"
            : savedAnswer === null
              ? "Lock in our prediction"
              : "Update our prediction"}
        </button>
      )}
      {!locked && savedAnswer !== null ? (
        <p role="status" className="text-sm text-emerald-700">
          Saved: {question.options[savedAnswer]}.{" "}
          {answer !== savedAnswer
            ? "Your new choice isn't saved yet."
            : "You can change it until the reveal."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="trivia-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ManualScore({
  data,
  guest,
  team,
  refresh,
}: {
  data: TriviaSnapshot;
  guest: GuestIdentity;
  team: number;
  refresh: () => Promise<void>;
}) {
  const round = data.rounds.find((r) => r.id === data.session.active_round_id)!;
  const savedScore = data.scores.find(
    (s) => s.team === team && s.round_id === round.id,
  )?.points;
  const [points, setPoints] = useState(savedScore?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await triviaRequest("/api/trivia/score", {
        guest_id: guest.id,
        team,
        round_id: round.id,
        points: Number(points),
      });
      setSaved(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className="text-xl font-bold">{round.name}</h3>
      <p className="text-sm text-gray-600">
        Enter your team's total for this round after the host announces the
        answers. Updating replaces the previous score.
      </p>
      <label className="block text-sm font-semibold">
        Round score (0–{round.max_points})
        <input
          className="trivia-input mt-2 text-2xl"
          type="number"
          inputMode="numeric"
          min={0}
          max={round.max_points}
          step={1}
          required
          value={points}
          onChange={(e) => {
            setPoints(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <button
        className="trivia-primary w-full"
        disabled={busy || points === ""}
      >
        {busy ? "Saving…" : "Save our round score"}
      </button>
      {savedScore !== undefined ? (
        <p className="text-sm text-gray-500">
          Currently saved: {savedScore} points
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-emerald-700">
          Score saved to the leaderboard!
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="trivia-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export default function TeamPlay({
  data,
  guest,
  refresh,
}: {
  data: TriviaSnapshot;
  guest: GuestIdentity;
  refresh: () => Promise<void>;
}) {
  const [team, setTeam] = useState(0);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("bacparty:trivia-team:v1"));
      if (stored >= 1 && stored <= 4) setTeam(stored);
    } catch {
      /* Selection still works without storage. */
    }
  }, []);
  const round = data.rounds.find((r) => r.id === data.session.active_round_id);
  return (
    <section className="trivia-card space-y-5">
      <div>
        <p className="trivia-eyebrow">Four teams · one very loved bride</p>
        <h2 className="mt-2 text-2xl font-bold text-rose-800">
          Pick your crew ✨
        </h2>
      </div>
      <label className="block text-sm font-semibold">
        Your team
        <select
          className="trivia-input mt-2"
          value={team}
          onChange={(e) => {
            const next = Number(e.target.value);
            setTeam(next);
            try {
              localStorage.setItem("bacparty:trivia-team:v1", String(next));
            } catch {
              /* Optional preference. */
            }
          }}
        >
          <option value={0}>Choose your team</option>
          {data.session.team_names.map((name, index) => (
            <option key={index} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {!team ? (
        <p className="text-sm text-gray-500">
          One captain per team keeps everyone's submissions in sync.
        </p>
      ) : !round ? (
        <p>Waiting for the host to choose a round…</p>
      ) : round.kind === "family_feud" ? (
        data.session.survey_open ? (
          <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            The guest survey is still open. Submit your secret votes first; team
            predictions begin when the host closes voting.
          </p>
        ) : (
          <Prediction
            key={`${team}:${data.session.question_index}`}
            data={data}
            guest={guest}
            team={team}
            refresh={refresh}
          />
        )
      ) : (
        <ManualScore
          key={`${team}:${round.id}`}
          data={data}
          guest={guest}
          team={team}
          refresh={refresh}
        />
      )}
    </section>
  );
}
