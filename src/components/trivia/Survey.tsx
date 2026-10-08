"use client";

import { useEffect, useState } from "react";
import type { GuestIdentity } from "@/lib/identity";
import {
  FEUD_QUESTIONS,
  validSurvey,
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
  const [draftWarning, setDraftWarning] = useState(false);
  const storageKey = `bacparty:feud-draft:${guest.id}:${questionSetVersion}`;
  const questionSignature = JSON.stringify(questions);

  useEffect(() => {
    let stopped = false;
    const draftQuestions = JSON.parse(questionSignature) as FeudQuestion[];
    let draft: SurveyAnswers | null = null;
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
          setAnswers(draft);
        }
      }
    } catch {
      setDraftWarning(true);
    }
    triviaRequest<SurveyResponse>(
      `/api/trivia/survey?guest=${encodeURIComponent(guest.id)}`,
    )
      .then((response) => {
        if (stopped) return;
        if (response.answers && !draft) {
          setAnswers(response.answers);
          setSaved(true);
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
  }, [guest.id, storageKey, questionSignature]);

  function choose(value: number) {
    const next = { ...answers, [questions[index].id]: value };
    setAnswers(next);
    setSaved(false);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setDraftWarning(true);
    }
  }
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await triviaRequest("/api/trivia/survey", {
        guest_id: guest.id,
        answers,
      });
      setSaved(true);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* The server has saved it. */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please retry.");
    } finally {
      setBusy(false);
    }
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
          all said.
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
            disabled={!validSurvey(answers, questions) || busy || loading}
            onClick={() => void submit()}
          >
            {busy
              ? "Saving…"
              : saved
                ? "Update my answers"
                : "Submit my secret votes"}
          </button>
        )}
      </div>
      {index === questions.length - 1 && !validSurvey(answers, questions) ? (
        <button
          className="text-sm font-semibold text-rose-600 underline"
          onClick={() =>
            setIndex(questions.findIndex((q) => answers[q.id] === undefined))
          }
        >
          Go to an unanswered question
        </button>
      ) : null}
      {saved ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          Your secret votes are saved! You can update them until the host closes
          voting.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          {draftWarning
            ? "Draft storage is unavailable on this device. Keep this page open until you submit."
            : "Your draft stays on this device. Tap Submit at the end to send your votes."}
        </p>
      )}
      {error ? (
        <p role="alert" className="trivia-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
