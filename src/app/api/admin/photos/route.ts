import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { apiError, checkDb, triviaQuery } from "@/lib/trivia/server";

export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await triviaQuery(
      "SELECT p.*, json_build_object('name',g.name) AS guests FROM public.photos p LEFT JOIN public.guests g ON g.id=p.guest_id WHERE p.category='pre_weekend' ORDER BY p.uploaded_at DESC LIMIT 1000",
    );
    checkDb(error);
    return NextResponse.json(
      { photos: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
