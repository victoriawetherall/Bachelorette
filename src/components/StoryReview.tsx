"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/feud";
import { judgeLiveAnswer } from "@/lib/liveQuiz";

type Review = { prompt: string; answer: string; teams: { id: string; name: string; answer: string | null; correct: boolean | null }[] };
export default function StoryReview({ accessKey, questions, refresh }: {
  accessKey: string; questions: { id: number; position: number; prompt: string }[]; refresh: () => void;
}) {
  const [id, setId] = useState<number | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    setReview(null); setError(null);
    if (id) void rpc<Review>("quiz_story_review", { p_key: accessKey, p_question_id: id }).then((value) => { if (!stopped) setReview(value); }).catch((err) => { if (!stopped) setError(err.message); });
    return () => { stopped = true; };
  }, [accessKey, id, version]);
  async function judge(teamId: string, correct: boolean) {
    if (!id || busy) return;
    setBusy(true); setError(null);
    try { await judgeLiveAnswer(accessKey, id, teamId, correct); setVersion((v) => v + 1); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn’t correct the ruling."); }
    finally { setBusy(false); }
  }
  return <details className="rounded-2xl border border-rose-200 bg-white p-5"><summary className="cursor-pointer font-bold text-rose-800">Review / correct a revealed question</summary><div className="mt-4 space-y-3">
    <p className="text-sm text-gray-600">Changing a ruling recalculates the round and overall scores.</p>
    <label className="block text-sm font-semibold text-rose-800">Question<select value={id ?? ""} disabled={busy} onChange={(event) => setId(Number(event.target.value))} className="mt-1 block w-full rounded-xl border border-rose-200 p-3"><option value="" disabled>Choose a revealed question</option>{questions.map((q) => <option key={q.id} value={q.id}>{q.position}. {q.prompt}</option>)}</select></label>
    {review && <><p className="text-gray-600">Accepted answer: {review.answer}</p>{review.teams.map((t) => <div key={t.id} className="space-y-2 border-t border-rose-100 pt-3"><p className="font-semibold text-rose-800">{t.name}: <span className="font-normal text-gray-700">{t.answer ?? "No answer"}</span></p>{t.answer && <div className="flex gap-3"><button type="button" disabled={busy} aria-pressed={t.correct === true} onClick={() => void judge(t.id, true)} className="rounded-xl border border-emerald-300 px-4 py-2 text-emerald-800 aria-pressed:bg-emerald-100">Correct ✓</button><button type="button" disabled={busy} aria-pressed={t.correct === false} onClick={() => void judge(t.id, false)} className="rounded-xl border border-red-300 px-4 py-2 text-red-800 aria-pressed:bg-red-100">Incorrect</button></div>}</div>)}</>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div></details>;
}
