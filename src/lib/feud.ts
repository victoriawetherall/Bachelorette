import questionData from "@/data/feud-questions.json";
import { insforge } from "./insforge";

export type AnswerKey = "A" | "B" | "C" | "D";
export type FeudQuestion = { id: number; prompt: string; options: { key: AnswerKey; text: string }[] };
export const FEUD_QUESTIONS = questionData as FeudQuestion[];
export type FeudTeam = {
  id: string; name: string; team_number: number; eligible_voters: number;
  completed_voters: number; raw_matches: number; points: number; matching_names: string[];
};
export type FeudState = {
  phase: "lobby" | "question" | "locked" | "reveal" | "leaderboard" | "finished";
  voting_open: boolean; current_question_id: number | null; scoring: "matches" | "adjusted";
  liv_guest_id: string; updated_at: string; total_questions: number; revealed_count: number;
  chosen_option: AnswerKey | null; distribution: Partial<Record<AnswerKey, number>> | null;
  teams: FeudTeam[];
  pending_option?: AnswerKey | null;
  submissions?: { guest_id: string; display_name: string; team_number: number; answered: number }[];
};
export type FeudBallot = { eligible: boolean; voting_open: boolean; answers: Record<number, AnswerKey> };

export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await insforge.database.rpc(name, args);
  if (error) {
    if (error.code === "P0001") throw new Error(error.message);
    throw new Error("We couldn’t connect to the quiz. Please try again shortly.");
  }
  return data as T;
}

export const readFeudState = (key?: string) => key
  ? rpc<FeudState>("feud_host_state", { p_key: key })
  : rpc<FeudState>("feud_state");
export const readBallot = (guestId: string) => rpc<FeudBallot>("feud_ballot", { p_guest_id: guestId });
export const saveVote = (guestId: string, questionId: number, option: AnswerKey) =>
  rpc("feud_save_vote", { p_guest_id: guestId, p_question_id: questionId, p_option: option });
export const checkFeudAccess = (key: string, role: "host" | "liv") =>
  rpc<boolean>("feud_check_access", { p_key: key, p_role: role });
export const chooseFeudAnswer = (key: string, questionId: number, option: AnswerKey) =>
  rpc("feud_choose", { p_key: key, p_question_id: questionId, p_option: option });
export const hostFeudAction = (key: string, action: string, questionId: number | null) =>
  rpc("feud_host_action", { p_key: key, p_action: action, p_question_id: questionId });
export const correctFeudAnswer = (key: string, questionId: number, option: AnswerKey) =>
  rpc("feud_correct_choice", { p_key: key, p_question_id: questionId, p_option: option });
export const formatPoints = (points: number) => Number(points).toLocaleString("en-AU", { maximumFractionDigits: 2 });
