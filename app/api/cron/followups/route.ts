import type { NextRequest } from "next/server";
import { runScheduled } from "@/lib/briefing/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Lembrete de follow-ups (dias úteis 13:30 em São Paulo = 16:30 UTC). Só envia se houver pendência. */
export function GET(request: NextRequest) {
  return runScheduled("followups", request);
}

export const POST = GET;
