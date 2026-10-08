import { NextResponse } from "next/server";
import {
  apiError,
  checkDb,
  getSession,
  requireGuest,
  sameOrigin,
  triviaQuery,
  TriviaError,
} from "@/lib/trivia/server";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const guestId = await requireGuest(body.guest_id);
    if (
      !Number.isInteger(body.team) ||
      body.team < 1 ||
      body.team > 4 ||
      !Number.isInteger(body.points) ||
      body.points < 0
    )
      throw new TriviaError("Choose a team and enter a whole-number score.");
    const session = await getSession();
    if (body.round_id !== session.active_round_id)
      throw new TriviaError(
        "The host has changed rounds. Refresh before saving.",
        409,
      );
    const { error } = await triviaQuery(
      "SELECT public.trivia_save_score($1, $2, $3, $4)",
      [guestId, body.team, body.round_id, body.points],
    );
    if (error?.message.includes("Invalid score"))
      throw new TriviaError(
        "That score is outside this round's allowed range.",
      );
    if (error?.message.includes("Round changed"))
      throw new TriviaError(
        "The host has changed rounds. Refresh before saving.",
        409,
      );
    checkDb(error);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
