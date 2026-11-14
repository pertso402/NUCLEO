import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/api-auth";
import { resolveOwnerId } from "@/lib/ingest/run";
import { generateRecurring } from "@/lib/recurring";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lançamentos recorrentes (todo dia 06:00 em São Paulo = 09:00 UTC): cria os `pending_review`
 * das regras que venceram. `?dry=1` só lista o que criaria.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const userId = await resolveOwnerId(supabase);
    const dry = request.nextUrl.searchParams.get("dry") === "1";
    const result = await generateRecurring(supabase, userId, new Date(), { dry });
    return NextResponse.json({ ok: true, dry, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron recorrentes falhou", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const POST = GET;
