import { NextResponse } from "next/server";
import {
  apiError,
  checkDb,
  requireGuest,
  getQuestions,
  sameOrigin,
  triviaQuery,
  TriviaError,
} from "@/lib/trivia/server";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    await requireGuest(params.get("guest"));
    const team = Number(params.get("team"));
    const question = Number(params.get("question"));
    const questions = await getQuestions();
    if (
      !Number.isInteger(team) ||
      team < 1 ||
      team > 4 ||
      !Number.isInteger(question) ||
      !questions[question]
    )
      throw new TriviaError("Choose a team and question.");
    const { data, error } = await triviaQuery(
      "SELECT answer_index FROM public.trivia_predictions WHERE team = $1 AND question_index = $2 LIMIT 1",
      [team, question],
    );
    checkDb(error);
    return NextResponse.json(
      { answer_index: data?.[0]?.answer_index ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const guestId = await requireGuest(body.guest_id);
    const questions = await getQuestions();
    if (
      !Number.isInteger(body.team) ||
      body.team < 1 ||
      body.team > 4 ||
      !Number.isInteger(body.question_index) ||
      !questions[body.question_index] ||
      !Number.isInteger(body.answer_index) ||
      !questions[body.question_index].options[body.answer_index]
    )
      throw new TriviaError("Choose one answer for your team.");
    const { error } = await triviaQuery(
      "SELECT public.trivia_save_prediction($1, $2, $3, $4)",
      [guestId, body.team, body.question_index, body.answer_index],
    );
    if (error?.message.includes("Predictions locked"))
      throw new TriviaError(
        "Predictions are locked. Wait for the next question.",
        409,
      );
    checkDb(error);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
