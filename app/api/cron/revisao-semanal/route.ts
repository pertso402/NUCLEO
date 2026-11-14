import type { NextRequest } from "next/server";
import { runScheduled } from "@/lib/briefing/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Revisão semanal (domingo 18:00 em São Paulo = 21:00 UTC). Ver lib/briefing/run.ts. */
export function GET(request: NextRequest) {
  return runScheduled("weekly", request);
}

export const POST = GET;
