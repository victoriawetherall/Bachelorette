import { NextResponse } from "next/server";
import {
  apiError,
  checkDb,
  getSession,
  getQuestions,
  requireGuest,
  sameOrigin,
  triviaQuery,
  TriviaError,
} from "@/lib/trivia/server";
import { validSurvey } from "@/lib/trivia/questions";

export async function GET(request: Request) {
  try {
    const guestId = await requireGuest(
      new URL(request.url).searchParams.get("guest"),
    );
    const session = await getSession();
    const { data, error } = await triviaQuery(
      "SELECT answers FROM public.trivia_votes WHERE guest_id = $1 LIMIT 1",
      [guestId],
    );
    checkDb(error);
    return NextResponse.json(
      { answers: data?.[0]?.answers ?? null, open: session.survey_open },
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
    if (!validSurvey(body.answers, questions))
      throw new TriviaError("Please choose one answer for every question.");
    const { error } = await triviaQuery(
      "SELECT public.trivia_submit_survey($1, $2::jsonb)",
      [guestId, JSON.stringify(body.answers)],
    );
    if (error?.message.includes("Survey closed"))
      throw new TriviaError(
        "Voting has closed. Your host is ready to play!",
        409,
      );
    if (error?.message.includes("Invalid survey"))
      throw new TriviaError(
        "The question list has changed. Refresh and answer every question.",
        409,
      );
    checkDb(error);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
