import { rpc } from "./feud";

export type LiveRound = "fake" | "stories" | "family";
export const LIVE_ROUNDS: Record<LiveRound, { number: number; title: string }> = {
  fake: { number: 3, title: "Facebook Archaeologist" },
  stories: { number: 3, title: "Story Time" },
  family: { number: 2, title: "Trivia" },
};
export type Captain = { team_id: string; guest_id: string | null; name: string | null };
export type LiveTeam = {
  id: string; name: string; team_number: number; captain_id: string | null;
  captain_name: string | null; submitted: boolean; answer: string | null;
  correct: boolean | null; points: number; submitted_by?: string | null;
};
export type LiveState = {
  slug: LiveRound; title: string;
  phase: "lobby" | "question" | "locked" | "reveal" | "leaderboard" | "finished";
  current_question_id: number | null; question_number: number; total_questions: number;
  revealed_count: number; points_per_correct: number; my_team_id: string | null;
  liv_guest_id: string; updated_at: string; prompt: string | null;
  options: { key: string; image?: string; text?: string }[]; correct_answer: string | null;
  story?: string | null;
  teams: LiveTeam[];
  questions?: { id: number; position: number; prompt: string; answer: string; enabled: boolean; revealed: boolean }[];
};
export type OverallTeam = {
  id: string; name: string; team_number: number;
  feud: number; fake: number; stories: number; ben: number; family: number; final: number; total: number;
};
export const isLiveRound = (value: string): value is LiveRound => value in LIVE_ROUNDS;
export const readCaptains = () => rpc<Captain[]>("quiz_captains");
export const claimCaptain = (guestId: string) => rpc("quiz_claim_captain", { p_guest_id: guestId });
export const setCaptain = (key: string, teamId: string, guestId: string) =>
  rpc("quiz_set_captain", { p_key: key, p_team_id: teamId, p_guest_id: guestId });
export const readLiveState = (round: LiveRound, guestId: string | null, key?: string) => key
  ? rpc<LiveState>("quiz_live_host_state", { p_key: key, p_round: round })
  : rpc<LiveState>("quiz_live_state", { p_round: round, p_guest_id: guestId });
export const submitLiveAnswer = (round: LiveRound, guestId: string, questionId: number, answer: string) =>
  rpc("quiz_live_submit", { p_guest_id: guestId, p_round: round, p_question_id: questionId, p_answer: answer });
export const liveAction = (key: string, round: LiveRound, action: string, questionId: number | null) =>
  rpc("quiz_live_action", { p_key: key, p_round: round, p_action: action, p_question_id: questionId });
export const judgeLiveAnswer = (key: string, questionId: number, teamId: string, correct: boolean) =>
  rpc("quiz_live_judge", { p_key: key, p_question_id: questionId, p_team_id: teamId, p_correct: correct });
export const configureLiveRound = (key: string, round: LiveRound, points: number) =>
  rpc("quiz_live_configure", { p_key: key, p_round: round, p_points: points });
export const editLiveQuestion = (key: string, round: LiveRound, id: number | null, prompt: string, answer: string, enabled: boolean) =>
  rpc("quiz_live_edit_question", { p_key: key, p_round: round, p_id: id, p_prompt: prompt, p_answer: answer, p_enabled: enabled });
export const readOverallScores = () => rpc<OverallTeam[]>("quiz_overall_scores");
