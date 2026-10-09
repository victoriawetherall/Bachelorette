import "server-only";
import { triviaQuery } from "./database";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  rankAnswers,
  type FeudQuestion,
  type SurveyAnswers,
} from "./questions";
import {
  scoreFeud,
  type TeamPrediction,
  type HostSnapshot,
  type TriviaRound,
  type TriviaScore,
  type TriviaSession,
} from "./types";

export class TriviaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function checkDb(error: { message: string } | null) {
  if (error) {
    console.error("Trivia database:", error.message);
    throw new TriviaError(
      "Trivia couldn't reach its saved data. Please retry or contact the organiser.",
      503,
    );
  }
}

const HOST_COOKIE = "bacparty-trivia-host";
export function hostToken(expires = Date.now() + 12 * 60 * 60 * 1000) {
  const secret = process.env.TRIVIA_HOST_PASSWORD;
  if (!secret)
    throw new TriviaError(
      "The organiser password hasn't been configured yet.",
      503,
    );
  const signature = createHmac("sha256", secret)
    .update(`liv-trivia-host-v1:${expires}`)
    .digest("hex");
  return `${expires}.${signature}`;
}
export async function requireHost() {
  const supplied = (await cookies()).get(HOST_COOKIE)?.value ?? "";
  const expires = Number(supplied.split(".")[0]);
  if (!Number.isSafeInteger(expires) || expires <= Date.now())
    throw new TriviaError("Please unlock the host controls.", 401);
  const expected = hostToken(expires);
  if (
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new TriviaError("Please unlock the host controls.", 401);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next can normalise request.url to localhost behind its server/proxy.
  // Host retains the actual browser-facing authority.
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  const protocol = request.headers.get("x-forwarded-proto");
  if (protocol === "http" || protocol === "https")
    expected.protocol = `${protocol}:`;
  if (!origin || origin !== expected.origin)
    throw new TriviaError("Please submit from the party app.", 403);
}
export async function requireGuest(id: unknown) {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new TriviaError("Please choose your name on the welcome page.", 401);
  const { data, error } = await triviaQuery(
    "SELECT id FROM public.guests WHERE id = $1 LIMIT 1",
    [id],
  );
  checkDb(error);
  if (!data?.length)
    throw new TriviaError("Please choose your name on the welcome page.", 401);
  return id;
}
export function apiError(error: unknown) {
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Please submit a valid request." },
      { status: 400 },
    );
  if (error instanceof TriviaError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error("Trivia request failed:", error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

export async function getSession(): Promise<TriviaSession> {
  const { data, error } = await triviaQuery<TriviaSession>(
    "SELECT id, survey_open, question_index, revealed_count, team_names, active_round_id, version, scored_questions, question_set_version FROM public.trivia_session WHERE id = 'liv-weekend'",
  );
  checkDb(error);
  if (!data?.[0])
    throw new TriviaError(
      "The trivia game hasn't been set up yet. Please contact the organiser.",
      503,
    );
  return data[0];
}

export async function getQuestions(): Promise<FeudQuestion[]> {
  const { data, error } = await triviaQuery<FeudQuestion>(
    "SELECT id, prompt, options FROM public.trivia_questions ORDER BY sort_order LIMIT 100",
  );
  checkDb(error);
  if (!data?.length)
    throw new TriviaError("The trivia questions haven't been set up yet.", 503);
  return data;
}

export async function getSnapshot(host: boolean): Promise<HostSnapshot> {
  // Read the version before the rows. A write during these reads will then
  // cause the next probe to refresh, rather than marking old rows as current.
  const session = await getSession();
  const [rounds, scores, votes, predictions, questions] = await Promise.all([
    triviaQuery<TriviaRound>(
      "SELECT id, name, kind, max_points, sort_order FROM public.trivia_rounds ORDER BY sort_order LIMIT 30",
    ),
    triviaQuery<TriviaScore>(
      "SELECT team, round_id, points FROM public.trivia_scores LIMIT 120",
    ),
    triviaQuery<{ answers: SurveyAnswers; guests: { name: string } | null }>(
      "SELECT v.answers, json_build_object('name', g.name) AS guests FROM public.trivia_votes v JOIN public.guests g ON g.id = v.guest_id LIMIT 200",
    ),
    triviaQuery<TeamPrediction>(
      "SELECT team, question_index, answer_index FROM public.trivia_predictions LIMIT 400",
    ),
    getQuestions(),
  ]);
  [rounds.error, scores.error, votes.error, predictions.error].forEach(checkDb);
  const voteRows = (votes.data ?? []) as unknown as {
    answers: SurveyAnswers;
    guests: { name: string } | null;
  }[];
  const results = questions.map((q) =>
    rankAnswers(
      q,
      voteRows.map((v) => v.answers),
    ),
  );
  const predictionRows = (predictions.data ?? []) as TeamPrediction[];
  const feud = (rounds.data as TriviaRound[]).find(
    (r) => r.kind === "family_feud",
  );
  const feudScores = feud
    ? scoreFeud(
        feud.id,
        predictionRows,
        questions,
        results,
        session.scored_questions,
      )
    : [];
  return {
    session,
    questions,
    rounds: (rounds.data ?? []) as TriviaRound[],
    scores: [...((scores.data ?? []) as TriviaScore[]), ...feudScores],
    response_count: voteRows.length,
    prediction_teams: predictionRows
      .filter((p) => p.question_index === session.question_index)
      .map((p) => p.team),
    revealed_answers:
      !session.survey_open && voteRows.length > 0
        ? results[session.question_index].slice(0, session.revealed_count)
        : [],
    results: host ? results : [],
    respondents: host ? voteRows.map((v) => v.guests?.name ?? "Guest") : [],
  };
}

export { HOST_COOKIE, triviaQuery };
