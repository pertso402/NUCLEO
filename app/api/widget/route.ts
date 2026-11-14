import { NextResponse, type NextRequest } from "next/server";
import { isValidApiToken } from "@/lib/api-auth";
import { loadHighlightMilestone } from "@/lib/data/milestone";
import { loadToday } from "@/lib/data/today";
import { resolveOwnerId } from "@/lib/ingest/run";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWidgetPayload } from "@/lib/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Widget do iPhone (Scriptable, ARCHITECTURE §9): GET com `x-nucleo-token`.
 * Devolve só números prontos do marco em destaque e do dia (ver `lib/widget.ts`).
 */
export async function GET(request: NextRequest) {
  if (!isValidApiToken(request.headers.get("x-nucleo-token"))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  // O iOS pede ~a cada 15 min; isso aqui só segura um loop.
  if (!rateLimit("widget", 60).ok) {
    return NextResponse.json({ error: "muitas requisições" }, { status: 429 });
  }
  try {
    const supabase = createAdminClient();
    const userId = await resolveOwnerId(supabase);
    const now = new Date();
    const [highlight, today] = await Promise.all([
      loadHighlightMilestone(supabase, { userId, now }),
      loadToday(now, { supabase, userId }),
    ]);
    return NextResponse.json(buildWidgetPayload(highlight, today, now), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("widget falhou", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "falha ao montar o widget" }, { status: 500 });
  }
}
