"use client";

import { useEffect, useState } from "react";
import { loadQuizTeams, type QuizTeam } from "./quizTeams";

export function useQuizTeams() {
  const [teams, setTeams] = useState<QuizTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadQuizTeams()
      .then((data) => {
        if (!cancelled) setTeams(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn’t load the teams.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { teams, loading, error, retry: () => setAttempt((value) => value + 1) };
}
