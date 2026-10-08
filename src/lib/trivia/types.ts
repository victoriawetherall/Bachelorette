import type { FeudQuestion, RankedAnswer, SurveyAnswers } from "./questions";

export type TriviaRound = {
  id: string;
  name: string;
  kind: "family_feud" | "manual";
  max_points: number;
  sort_order: number;
};
export type TriviaScore = { team: number; round_id: string; points: number };
export type TriviaSession = {
  id: string;
  survey_open: boolean;
  question_index: number;
  revealed_count: number;
  team_names: string[];
  active_round_id: string | null;
  version: string;
  scored_questions: number[];
  question_set_version: string;
};
export type TriviaSnapshot = {
  session: TriviaSession;
  rounds: TriviaRound[];
  scores: TriviaScore[];
  response_count: number;
  revealed_answers: RankedAnswer[];
  prediction_teams: number[];
  questions: FeudQuestion[];
};
export type HostSnapshot = TriviaSnapshot & {
  results: RankedAnswer[][];
  respondents: string[];
};
export type SurveyResponse = { answers: SurveyAnswers | null; open: boolean };

export function teamTotals(scores: TriviaScore[]) {
  return [1, 2, 3, 4].map((team) => ({
    team,
    total: scores
      .filter((s) => s.team === team)
      .reduce((sum, s) => sum + s.points, 0),
  }));
}

export type TeamPrediction = {
  team: number;
  question_index: number;
  answer_index: number;
};

export function scoreFeud(
  roundId: string,
  predictions: TeamPrediction[],
  questions: FeudQuestion[],
  results: RankedAnswer[][],
  scoredQuestions: number[],
): TriviaScore[] {
  return [1, 2, 3, 4].map((team) => ({
    team,
    round_id: roundId,
    points:
      predictions.filter(
        (p) =>
          p.team === team &&
          scoredQuestions.includes(p.question_index) &&
          results[p.question_index].some(
            (a) =>
              a.votes > 0 &&
              a.rank === 1 &&
              a.option === questions[p.question_index].options[p.answer_index],
          ),
      ).length * 10,
  }));
}
