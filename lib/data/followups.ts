import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/dates";
import { classifyFollowups, type FollowupKind } from "@/lib/metrics/pipeline";
import { createClient } from "@/lib/supabase/server";
import { LEAD_COLS, toLead, type Lead } from "./pipeline";

export interface Followup {
  lead: Lead;
  kind: FollowupKind;
}

/**
 * Follow-ups de hoje, atrasados e propostas paradas (ARCHITECTURE §6.4).
 * Sem `ctx`: sessão; com `ctx` (cron): client admin + dono.
 */
export async function loadFollowups(now = new Date(), ctx?: { supabase: SupabaseClient; userId: string }): Promise<Followup[]> {
  const supabase = ctx?.supabase ?? (await createClient());
  const today = todayISO(now);
  let q = supabase
    .from("crm_leads")
    .select(LEAD_COLS)
    .in("stage", ["abordado", "conversou", "reuniao", "proposta"])
    .or(`next_action_on.lte.${today},stage.eq.proposta`)
    .limit(200);
  if (ctx) q = q.eq("user_id", ctx.userId);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler follow-ups: ${error.message}`);
  return classifyFollowups((data ?? []).map(toLead), today, now);
}
