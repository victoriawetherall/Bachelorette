"use client";

import { useEffect, useState } from "react";
import { readAdvice, saveAdvice } from "@/lib/feud";

const MAX = 280;

export default function AdviceCard({ guestId }: { guestId: string }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    void readAdvice(guestId).then((body) => {
      if (stopped) return;
      setSaved(body ?? ""); setText(body ?? ""); setLoaded(true);
    }).catch(() => { if (!stopped) setLoaded(true); });
    return () => { stopped = true; };
  }, [guestId]);
  async function save() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await saveAdvice(guestId, text); setSaved(text.trim()); setText(text.trim()); }
    catch (err) { setError(err instanceof Error ? err.message : "Your advice hasn’t saved. Please try again."); }
    finally { setBusy(false); }
  }
  const unchanged = text.trim() === (saved ?? "");
  return <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5">
    <h2 className="text-lg font-bold text-rose-800">One last thing 💍</h2>
    <label htmlFor="advice" className="block text-sm text-gray-700">What’s your favourite bit of marriage advice for the happy couple?</label>
    <textarea id="advice" maxLength={MAX} rows={4} value={text} disabled={!loaded || busy} onChange={(event) => setText(event.target.value)}
      placeholder="Never go to bed angry… or at least not hungry."
      className="block w-full rounded-xl border border-rose-200 p-3 text-base focus:outline-rose-500" />
    <div className="flex items-center justify-between gap-3">
      <p role="status" className="text-sm font-semibold text-rose-700">{busy ? "Saving…" : saved && unchanged ? "Advice saved ✓" : `${MAX - text.length} characters left`}</p>
      <button type="button" disabled={!loaded || busy || unchanged} onClick={() => void save()} className="rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-40">Save advice</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
