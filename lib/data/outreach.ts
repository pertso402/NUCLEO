import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayInstantRange, type ISODate } from "@/lib/dates";

/**
 * Abordagens de um dia (ARCHITECTURE §4.5) = leads criados nesse dia já em "abordado"
 * (evento de etapa sem origem) + abordagens registradas em lote (`outreach_logs`).
 * Sempre filtra por `userId` (vale para a sessão e para o client admin).
 */
export async function countOutreach(supabase: SupabaseClient, userId: string, day: ISODate): Promise<number> {
  const { from, to } = dayInstantRange(day);
  const [logs, leads] = await Promise.all([
    supabase.from("outreach_logs").select("count").eq("user_id", userId).eq("log_date", day),
    supabase
      .from("crm_lead_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "stage_change")
      .is("from_stage", null)
      .eq("to_stage", "abordado")
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString()),
  ]);
  const logged = (logs.data ?? []).reduce((s: number, r: { count: number }) => s + Number(r.count), 0);
  return logged + (leads.count ?? 0);
}
