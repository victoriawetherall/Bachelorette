"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TriviaSnapshot } from "./types";

export async function triviaRequest<T>(
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error ?? "Couldn't connect. Please try again.");
  return value as T;
}

// Poll only a one-row version probe; snapshots are fetched only after changes.
export function useTrivia<T extends TriviaSnapshot = TriviaSnapshot>(
  endpoint = "/api/trivia",
  enabled = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const version = useRef("");
  const refresh = useCallback(async () => {
    try {
      const value = await triviaRequest<T>(endpoint);
      version.current = value.session.version;
      setData(value);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let busy = false;
    async function poll() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const value = await triviaRequest<T | { unchanged: true }>(
          `${endpoint}?version=${encodeURIComponent(version.current)}`,
        );
        if (!stopped) {
          if (!("unchanged" in value)) {
            version.current = value.session.version;
            setData(value);
          }
          setError(null);
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Couldn't connect.");
      } finally {
        busy = false;
        if (!stopped) setLoading(false);
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [endpoint, enabled]);
  return { data, error, loading, refresh };
}
