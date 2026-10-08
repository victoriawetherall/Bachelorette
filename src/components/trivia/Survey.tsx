"use client";

import { useEffect, useRef, useState } from "react";
import type { GuestIdentity } from "@/lib/identity";
import {
  FEUD_QUESTIONS,
  type SurveyAnswers,
  type FeudQuestion,
} from "@/lib/trivia/questions";
import { triviaRequest } from "@/lib/trivia/client";
import type { SurveyResponse } from "@/lib/trivia/types";

export default function Survey({
  guest,
  open,
  questions = FEUD_QUESTIONS,
  questionSetVersion,
}: {
  guest: GuestIdentity;
  open: boolean;
  questions: FeudQuestion[];
  questionSetVersion: string;
}) {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const pending = useRef<SurveyAnswers>({});
  const [draftWarning, setDraftWarning] = useState(false);
  const storageKey = `bacparty:feud-draft:${guest.id}:${questionSetVersion}`;
  const questionSignature = JSON.stringify(questions);

  useEffect(() => {
    let stopped = false;
    const draftQuestions = JSON.parse(questionSignature) as FeudQuestion[];
    let draft: SurveyAnswers = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          draft = Object.fromEntries(
            draftQuestions
              .filter(
                (q) =>
                  Number.isInteger(parsed[q.id]) &&
                  parsed[q.id] >= 0 &&
                  parsed[q.id] < q.options.length,
              )
              .map((q) => [q.id, parsed[q.id]]),
          );
        }
      }
    } catch {
      setDraftWarning(true);
    }
    pending.current = draft;
    setAnswers(draft);
    setLoading(true);
    setSaved(false);
    setError(null);
    async function load() {
      try {
        const response = await triviaRequest<SurveyResponse>(
          `/api/trivia/survey?guest=${encodeURIComponent(guest.id)}`,
        );
        if (stopped) return;
        setAnswers({ ...response.answers, ...draft });
        setSaved(Object.keys(response.answers ?? {}).length > 0);
        if (response.open && Object.keys(draft).length > 0) {
          setSaved(false);
          const result = await triviaRequest<{ answers: SurveyAnswers }>(
            "/api/trivia/survey",
            {
              guest_id: guest.id,
              answers: draft,
            },
          );
          if (stopped) return;
          pending.current = {};
          setAnswers(result.answers);
          setSaved(true);
          try {
            if (localStorage.getItem(storageKey) === JSON.stringify(draft))
              localStorage.removeItem(storageKey);
          } catch {
            /* Saved on the server. */
          }
        }
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "Couldn't load your answers.",
          );
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void load();
    return () => {
      stopped = true;
    };
  }, [guest.id, storageKey, questionSignature]);

  async function savePending() {
    if (Object.keys(pending.current).length === 0) return;
    const patch = { ...pending.current };
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const result = await triviaRequest<{ answers: SurveyAnswers }>(
        "/api/trivia/survey",
        {
          guest_id: guest.id,
          answers: patch,
        },
      );
      pending.current = {};
      setAnswers(result.answers);
      setSaved(true);
      try {
        if (localStorage.getItem(storageKey) === JSON.stringify(patch))
          localStorage.removeItem(storageKey);
      } catch {
        /* Saved on the server. */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  function choose(value: number) {
    if (loading || busy) return;
    const id = questions[index].id;
    setAnswers({ ...answers, [id]: value });
    pending.current = { ...pending.current, [id]: value };
    try {
      localStorage.setItem(storageKey, JSON.stringify(pending.current));
    } catch {
      setDraftWarning(true);
    }
    void savePending();
  }

  const question = questions[index];
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  if (!open)
    return (
      <section className="trivia-card text-center">
        <span className="text-4xl">🤫</span>
        <h2 className="mt-3 text-xl font-bold text-rose-800">
          The survey is sealed!
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Time to find out how well Liv knows her friends. Head to Play with
          your team.
        </p>
      </section>
    );
  if (finished && !error)
    return (
      <section className="trivia-card space-y-4 text-center">
        <h2 className="text-2xl font-bold text-rose-800">
          Thanks for voting! 💭
        </h2>
        <p>
          {answered > 0
            ? `Your ${answered} ${answered === 1 ? "answer is" : "answers are"} saved and will count in the game.`
            : "You haven't answered any questions yet."}{" "}
          Skipped questions cast no vote.
        </p>
        <button
          className="trivia-secondary"
          onClick={() => {
            setFinished(false);
            setIndex(0);
          }}
        >
          Review my answers
        </button>
      </section>
    );
  return (
    <section className="trivia-card space-y-5">
      <div>
        <p className="trivia-eyebrow">Before the party · guest survey</p>
        <h2 className="mt-2 text-2xl font-bold text-rose-800">
          Liv, according to us 💭
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Hi {guest.name}! Pick the answer that feels most like Liv. Vote
          independently and keep your choices secret — Liv will guess what we
          all said. Each answer saves as soon as you choose it. Skip any
          question you like.
        </p>
      </div>
      {loading ? <p role="status">Checking your saved answers…</p> : null}
      <div className="flex items-center justify-between text-xs font-semibold text-rose-600">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span>
          {answered}/{questions.length} answered
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-rose-500 transition-all"
          style={{ width: `${(answered / questions.length) * 100}%` }}
        />
      </div>
      <fieldset disabled={loading || busy} className="space-y-3">
        <legend className="mb-4 text-xl font-bold">{question.prompt}</legend>
        {question.options.map((option, value) => (
          <label
            key={option}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm transition ${answers[question.id] === value ? "border-rose-500 bg-rose-50 text-rose-900" : "border-rose-100 bg-white hover:border-rose-300"}`}
          >
            <input
              type="radio"
              name={question.id}
              checked={answers[question.id] === value}
              onChange={() => choose(value)}
              className="h-4 w-4 accent-rose-600"
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-3">
        <button
          className="trivia-secondary"
          disabled={index === 0 || busy}
          onClick={() => setIndex(index - 1)}
        >
          Back
        </button>
        {index < questions.length - 1 ? (
          <button
            className="trivia-primary flex-1"
            disabled={answers[question.id] === undefined || busy || loading}
            onClick={() => setIndex(index + 1)}
          >
            Next question →
          </button>
        ) : (
          <button
            className="trivia-primary flex-1"
            disabled={busy || loading || Boolean(error)}
            onClick={() => setFinished(true)}
          >
            Finish
          </button>
        )}
      </div>
      {answers[question.id] === undefined ? (
        <button
          className="min-h-11 w-full text-sm font-semibold text-rose-600 underline"
          disabled={loading || busy}
          onClick={() =>
            index < questions.length - 1
              ? setIndex(index + 1)
              : setFinished(true)
          }
        >
          Skip question →
        </button>
      ) : null}
      <p
        role="status"
        className={
          saved && !busy && !error
            ? "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
            : "text-xs text-gray-500"
        }
      >
        {busy
          ? "Saving your answer…"
          : error
            ? "Some answers may not be saved yet."
            : saved
              ? "Your answers are saved! You can stop here or keep going, and update them until voting closes."
              : "Answers save automatically. Skipped questions cast no vote."}
      </p>
      {draftWarning ? (
        <p className="text-xs text-gray-500">
          This device cannot keep a backup. Check that your answer is saved
          before leaving.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="trivia-error">
          {error}
          {Object.keys(pending.current).length > 0 ? (
            <button
              disabled={busy}
              className="ml-2 font-semibold underline"
              onClick={() => void savePending()}
            >
              Retry save
            </button>
          ) : (
            <button
              className="ml-2 font-semibold underline"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
