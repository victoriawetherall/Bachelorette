import { rpc } from "./feud";

export type BenTeam = {
  id: string; name: string; team_number: number; points: number;
  submitted: boolean; prediction: boolean | null; submitted_by?: string | null;
};
export type BenState = {
  phase: "lobby" | "question" | "locked" | "reveal" | "judged" | "leaderboard" | "finished";
  current_question_id: number | null; question_number: number; total_questions: number; judged_count: number;
  prompt: string | null; ben_answer: string | null; liv_right: boolean | null;
  liv_guest_id: string; my_team_id: string | null; updated_at: string; teams: BenTeam[];
  questions?: { id: number; prompt: string; ben_answer: string; liv_right: boolean | null }[];
};

export const readBenState = (guestId: string | null, key?: string) => key
  ? rpc<BenState>("ben_host_state", { p_key: key })
  : rpc<BenState>("ben_state", { p_guest_id: guestId });
export const saveBenPrediction = (guestId: string, questionId: number, livRight: boolean) =>
  rpc("ben_save_prediction", { p_guest_id: guestId, p_question_id: questionId, p_liv_right: livRight });
export const hostBenAction = (key: string, action: string, questionId: number | null) =>
  rpc("ben_host_action", { p_key: key, p_action: action, p_question_id: questionId });
export const correctBenResult = (key: string, questionId: number, livRight: boolean) =>
  rpc("ben_correct_result", { p_key: key, p_question_id: questionId, p_liv_right: livRight });
export const predictionLabel = (livRight: boolean | null) =>
  livRight === null ? "No pick" : livRight ? "Liv gets it ✅" : "Liv misses ❌";
