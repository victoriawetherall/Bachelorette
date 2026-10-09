import { rpc } from "./feud";

export const ROUND_ORDER = [
  { slug: "feud", number: 1, title: "Family Feud" },
  { slug: "family", number: 2, title: "Trivia" },
  { slug: "fake", number: 3, title: "Facebook Archaeologist" },
  { slug: "ben", number: 4, title: "What Did Ben Say?" },
  { slug: "final", number: 5, title: "Final Round" },
] as const;
export type FlowRound = (typeof ROUND_ORDER)[number];
export type QuizProgress = { liv_guest_id: string } & Record<FlowRound["slug"], string | null>;

export const readProgress = () => rpc<QuizProgress>("quiz_progress");
export const pickCaptain = (guestId: string, captainId: string) =>
  rpc("quiz_pick_captain", { p_guest_id: guestId, p_captain_id: captainId });

// The live round is the highest-numbered round that has left the lobby, so a
// round Harry forgot to finish never hides the next one. Once it's finished,
// guests wait for the next round still in the lobby.
export function currentRound(progress: QuizProgress): { live: FlowRound | null; next: FlowRound | null } {
  const started = [...ROUND_ORDER].reverse().find((round) => progress[round.slug] && progress[round.slug] !== "lobby");
  if (started && progress[started.slug] !== "finished") return { live: started, next: null };
  const later = started ? ROUND_ORDER.slice(ROUND_ORDER.indexOf(started) + 1) : ROUND_ORDER;
  return { live: null, next: later.find((round) => progress[round.slug] === "lobby") ?? null };
}
