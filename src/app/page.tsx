"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { insforge, type SpikeMessage } from "@/lib/insforge";

export default function SpikePage() {
  const [messages, setMessages] = useState<SpikeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await insforge.database
      .from("spike_messages")
      .select("id, message, created_at")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setMessages([]);
    } else {
      setMessages((data as SpikeMessage[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    setStatus(null);

    const { error: insertError } = await insforge.database
      .from("spike_messages")
      .insert({ message: trimmed })
      .select();

    if (insertError) {
      setError(insertError.message);
    } else {
      setDraft("");
      setStatus("Message saved to Insforge!");
      await loadMessages();
    }

    setSubmitting(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10">
      <header className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
          Phase 1 spike
        </p>
        <h1 className="text-3xl font-bold text-rose-700">
          Insforge read/write test
        </h1>
        <p className="text-sm text-gray-600">
          Add a message below — it goes straight to the{" "}
          <code className="rounded bg-rose-100 px-1">spike_messages</code> table
          in Insforge.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm"
      >
        <label htmlFor="message" className="mb-2 block text-sm font-medium">
          Your test message
        </label>
        <textarea
          id="message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="e.g. Hello from the bachelorette site!"
          className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="mt-3 w-full rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save to Insforge"}
        </button>
      </form>

      {status && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {status}
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Error: {error}
        </p>
      )}

      <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-rose-700">Messages</h2>
          <button
            type="button"
            onClick={() => void loadMessages()}
            className="text-sm font-medium text-rose-500 hover:text-rose-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages yet — add one above!</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-rose-50 px-3 py-2 text-sm"
              >
                <p>{item.message}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
