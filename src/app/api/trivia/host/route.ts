import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  apiError,
  checkDb,
  getSession,
  getQuestions,
  getSnapshot,
  HOST_COOKIE,
  hostToken,
  requireHost,
  sameOrigin,
  triviaQuery,
  TriviaError,
} from "@/lib/trivia/server";

export async function GET(request: Request) {
  try {
    await requireHost();
    const version = new URL(request.url).searchParams.get("version");
    if (version && (await getSession()).version === version)
      return NextResponse.json({ unchanged: true });
    return NextResponse.json(await getSnapshot(true), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (body.action === "login") {
      const expected = process.env.TRIVIA_HOST_PASSWORD;
      if (!expected)
        throw new TriviaError(
          "Set TRIVIA_HOST_PASSWORD on the server to unlock hosting.",
          503,
        );
      if (
        typeof body.password !== "string" ||
        Buffer.byteLength(body.password) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(body.password), Buffer.from(expected))
      )
        throw new TriviaError("That password doesn't match.", 401);
      (await cookies()).set(HOST_COOKIE, hostToken(), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/api/trivia/host",
        maxAge: 60 * 60 * 12,
      });
      return NextResponse.json({ unlocked: true });
    }
    await requireHost();
    if (body.action === "logout") {
      (await cookies()).set(HOST_COOKIE, "", {
        path: "/api/trivia/host",
        maxAge: 0,
      });
      return NextResponse.json({ unlocked: false });
    }
    const allowed = [
      "close_survey",
      "open_survey",
      "question",
      "reveal",
      "round",
      "teams",
      "add_round",
    ];
    if (!allowed.includes(body.action))
      throw new TriviaError("Unknown host action.");
    const questions = await getQuestions();
    if (
      body.action === "question" &&
      (!Number.isInteger(body.value) ||
        body.value < 0 ||
        body.value >= questions.length)
    )
      throw new TriviaError("Choose a valid question.");
    if (
      body.action === "reveal" &&
      (!Number.isInteger(body.value) ||
        body.value < 1 ||
        body.value >
          questions[(await getSession()).question_index].options.length)
    )
      throw new TriviaError("Choose a valid reveal count.");
    if (body.action === "round" && typeof body.value !== "string")
      throw new TriviaError("Choose a round.");
    if (
      body.action === "teams" &&
      (!Array.isArray(body.value) ||
        body.value.length !== 4 ||
        body.value.some(
          (n: unknown) => typeof n !== "string" || !n.trim() || n.length > 40,
        ))
    )
      throw new TriviaError("Enter four team names, up to 40 characters each.");
    if (
      body.action === "add_round" &&
      (!body.value ||
        typeof body.value.name !== "string" ||
        !body.value.name.trim() ||
        body.value.name.length > 60 ||
        !Number.isInteger(body.value.max_points) ||
        body.value.max_points < 1 ||
        body.value.max_points > 10000)
    )
      throw new TriviaError(
        "Enter a round name and a maximum score from 1 to 10,000.",
      );
    const { error } = await triviaQuery(
      "SELECT public.trivia_host_action($1, $2::jsonb)",
      [body.action, JSON.stringify(body.value ?? null)],
    );
    if (error?.message.includes("Host rule:"))
      throw new TriviaError(error.message.split("Host rule:")[1].trim(), 409);
    checkDb(error);
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
