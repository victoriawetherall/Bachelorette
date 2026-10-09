"use client";

import { useEffect, useState } from "react";

// Bounded RPCs, one request at a time. Hidden tabs do not poll.
export function useQuizResource<T>(read: () => Promise<T>) {
  const [snapshot, setSnapshot] = useState<{ source: typeof read; value: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll(initial = false) {
      if (stopped || running || (document.hidden && !initial)) return;
      clearTimeout(timer);
      running = true;
      try {
        const value = await read();
        if (!stopped) { setSnapshot({ source: read, value }); setError(null); }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Reconnecting to the quiz…");
      } finally {
        running = false;
        if (!stopped && !document.hidden) timer = setTimeout(poll, 2000);
      }
    }
    function resume() { if (document.hidden) clearTimeout(timer); else void poll(); }
    void poll(true);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true; clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [read, version]);
  return { state: snapshot?.source === read ? snapshot.value : null, error, refresh: () => setVersion((v) => v + 1) };
}
