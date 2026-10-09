"use client";

import { useEffect, useState } from "react";
import { readBenState, type BenState } from "./ben";

// Same polling approach as useFeudState.
export function useBenState(guestId: string | null, accessKey?: string) {
  const [state, setState] = useState<BenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (running || stopped) return;
      clearTimeout(timer);
      running = true;
      try {
        const value = await readBenState(guestId, accessKey);
        if (!stopped) { setState(value); setError(null); }
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : "Reconnecting to the quiz…");
      } finally {
        running = false;
        if (!stopped) timer = setTimeout(poll, document.hidden ? 10000 : 2000);
      }
    }
    function resume() { if (!document.hidden) void poll(); }
    void poll();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [guestId, accessKey, version]);

  return { state, error, refresh: () => setVersion((value) => value + 1) };
}
