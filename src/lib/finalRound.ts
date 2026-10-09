import { rpc } from "./feud";

export type FinalAward = { place: number; no: number; revealed: boolean; author?: string; team?: string; points?: number };
export type FinalState = {
  phase: "lobby" | "reading" | "finished";
  revealed_places: number; places: number; entry_count: number; updated_at: string;
  entries: { no: number; body: string }[];
  awards: FinalAward[];
  missing?: string[];
};

export const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
export const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

export const readFinalState = () => rpc<FinalState>("quiz_final_state");
export const readFinalHostState = (key: string) => rpc<FinalState>("quiz_final_host_state", { p_key: key });
export const finalAction = (key: string, action: string, place: number | null = null, no: number | null = null) =>
  rpc("quiz_final_action", { p_key: key, p_action: action, p_place: place, p_no: no });
