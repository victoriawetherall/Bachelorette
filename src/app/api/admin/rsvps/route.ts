import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";
import { apiError, checkDb, triviaQuery } from "@/lib/trivia/server";

export async function GET() {
  try {
    await requireAdmin();
    const [guests, sessions, budget, rsvps] = await Promise.all([
      triviaQuery(
        "SELECT id,name,created_at FROM public.guests ORDER BY name LIMIT 200",
      ),
      triviaQuery(
        "SELECT id,label,active,sort_order FROM public.sessions ORDER BY sort_order LIMIT 100",
      ),
      triviaQuery(
        "SELECT id,label,cost_per_person::float8 AS cost_per_person,applies_to FROM public.budget_items LIMIT 100",
      ),
      triviaQuery(
        "SELECT r.*, coalesce(json_agg(json_build_object('session_id',s.session_id)) FILTER (WHERE s.session_id IS NOT NULL),'[]'::json) AS rsvp_sessions FROM public.rsvps r LEFT JOIN public.rsvp_sessions s ON s.rsvp_id=r.id GROUP BY r.id LIMIT 200",
      ),
    ]);
    [guests.error, sessions.error, budget.error, rsvps.error].forEach(checkDb);
    return NextResponse.json(
      {
        guests: guests.data,
        sessions: sessions.data,
        budget: budget.data,
        rsvps: rsvps.data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
