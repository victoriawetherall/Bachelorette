import { NextResponse } from "next/server";
import { apiError, getSession, getSnapshot } from "@/lib/trivia/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const version = new URL(request.url).searchParams.get("version");
    if (version && (await getSession()).version === version)
      return NextResponse.json({ unchanged: true });
    const {
      results: _results,
      respondents: _respondents,
      ...snapshot
    } = await getSnapshot(false);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
