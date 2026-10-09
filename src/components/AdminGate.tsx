"use client";

import { type FormEvent, useEffect, useState } from "react";
import { isAdminUnlocked, unlockAdmin } from "@/lib/adminAuth";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    void isAdminUnlocked().then((valid) => {
      if (!stopped) { setUnlocked(valid); setReady(true); }
    });
    return () => { stopped = true; };
  }, []);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await unlockAdmin(password);
      setUnlocked(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t unlock the organiser view.");
    } finally { setBusy(false); }
  }

  if (!ready) return <p role="status" className="py-10 text-center text-sm text-gray-500">Loading…</p>;
  if (unlocked) return children;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-rose-700">Organiser login</h1>
      <form onSubmit={handleUnlock} className="space-y-4 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-rose-200 px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">{busy ? "Checking…" : "Unlock"}</button>
        {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
      </form>
    </main>
  );
}
