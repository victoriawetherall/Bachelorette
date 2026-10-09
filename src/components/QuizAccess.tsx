"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { checkFeudAccess } from "@/lib/feud";

export default function QuizAccess({ role, children }: { role: "host" | "liv"; children: (key: string, lock: () => void) => ReactNode }) {
  const storageKey = `bacparty:feud:${role}`;
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) { setBusy(false); return; }
    checkFeudAccess(saved, role).then((valid) => {
      if (!stopped && valid) setKey(saved);
      if (!valid) sessionStorage.removeItem(storageKey);
    }).catch(() => {}).finally(() => { if (!stopped) setBusy(false); });
    return () => { stopped = true; };
  }, [role, storageKey]);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const accessKey = input.trim();
      if (!await checkFeudAccess(accessKey, role)) throw new Error("That access code doesn’t match. Please check it and try again.");
      sessionStorage.setItem(storageKey, accessKey); setKey(accessKey); setInput("");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t unlock the quiz."); }
    finally { setBusy(false); }
  }
  if (key) return children(key, () => { sessionStorage.removeItem(storageKey); setKey(null); });
  return <main className="mx-auto max-w-sm space-y-5 px-4 py-12">
    <h1 className="text-center text-2xl font-bold text-rose-800">{role === "host" ? "Quiz host controls" : "Liv’s quiz screen 💖"}</h1>
    <p className="text-center text-sm text-gray-600">{role === "host" ? "Enter your private host code." : "Harry has your access code. Your choices stay hidden until the reveal."}</p>
    <form onSubmit={unlock} className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5">
      <label htmlFor="quiz-access" className="block text-sm font-semibold text-gray-700">{role === "host" ? "Host" : "Liv’s"} access code</label>
      <input id="quiz-access" type="password" autoComplete="current-password" required value={input} onChange={(event) => setInput(event.target.value)} className="w-full rounded-xl border border-rose-200 p-3 text-base focus:outline-rose-500" />
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-rose-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Checking…" : "Open quiz"}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  </main>;
}
