import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { adminToken, ADMIN_COOKIE, requireAdmin } from "@/lib/server/adminAuth";
import { apiError, sameOrigin, TriviaError } from "@/lib/trivia/server";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(
      { unlocked: true },
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
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected)
      throw new TriviaError("The organiser password isn't configured.", 503);
    if (
      typeof body.password !== "string" ||
      Buffer.byteLength(body.password) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(body.password), Buffer.from(expected))
    )
      throw new TriviaError("Wrong password.", 401);
    (await cookies()).set(ADMIN_COOKIE, adminToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin",
      maxAge: 12 * 60 * 60,
    });
    return NextResponse.json({ unlocked: true });
  } catch (error) {
    return apiError(error);
  }
}
