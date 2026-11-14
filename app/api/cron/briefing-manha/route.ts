import type { NextRequest } from "next/server";
import { runScheduled } from "@/lib/briefing/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Briefing da manhã (dias úteis 07:30 em São Paulo = 10:30 UTC). Ver lib/briefing/run.ts. */
export function GET(request: NextRequest) {
  return runScheduled("briefing", request);
}

export const POST = GET;
