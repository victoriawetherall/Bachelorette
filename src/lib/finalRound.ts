import { rpc } from "./feud";

// rank is Liv's spot for the card (#1 = favourite). Authors only exist once revealed.
export type FinalEntry = { no: number; body: string; rank: number | null; author?: string; team?: string; points?: number };
export type FinalState = {
  phase: "lobby" | "ranking" | "reveal" | "finished";
  revealed_places: number; places: number; entry_count: number; updated_at: string;
  current: number | null; last_placed: number | null;
  swaps_used: number; max_swaps: number; last_swap: [number, number] | null;
  entries: FinalEntry[];
  missing?: string[];
};

export const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉", 4: "🏅", 5: "🏅" };
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
export const pointsFor = (rank: number) => (rank >= 1 && rank <= 5 ? 6 - rank : 0);

export const readFinalState = () => rpc<FinalState>("quiz_final_state");
export const readFinalHostState = (key: string) => rpc<FinalState>("quiz_final_host_state", { p_key: key });
export const finalAction = (key: string, action: string, rank: number | null = null, other: number | null = null) =>
  rpc("quiz_final_action", { p_key: key, p_action: action, p_rank: rank, p_other: other });
