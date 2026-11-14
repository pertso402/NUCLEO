import type { NextRequest } from "next/server";
import { runScheduled } from "@/lib/briefing/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fechamento do dia (21:30 em São Paulo = 00:30 UTC). Ver lib/briefing/run.ts. */
export function GET(request: NextRequest) {
  return runScheduled("closing", request);
}

export const POST = GET;
