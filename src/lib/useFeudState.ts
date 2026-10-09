"use client";

import { useEffect, useState } from "react";
import { readFeudState, type FeudState } from "./feud";

export function useFeudState(accessKey?: string) {
  const [state, setState] = useState<FeudState | null>(null);
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
        const value = await readFeudState(accessKey);
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
  }, [accessKey, version]);

  return { state, error, refresh: () => setVersion((value) => value + 1) };
}
