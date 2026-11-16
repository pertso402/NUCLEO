import "server-only";
import { stageCounts, type RateKey } from "@/lib/metrics/funnel";
import { lostReasons, originStats, type AnalyticsLead, type OriginStat } from "@/lib/metrics/pipeline-analytics";
import type { LostReason } from "@/lib/metrics/pipeline";
import { toCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface PipelineAnalytics {
  /** Conversão por etapa nos últimos 90 dias (contagem crua). */
  stages: Record<RateKey, { sample: number; advanced: number }>;
  /** Motivos de perda dos últimos 180 dias. */
  lost: { total: number; items: { reason: LostReason; count: number; share: number }[] };
  /** Origens dos leads criados nos últimos 180 dias. */
  origins: OriginStat[];
}

export async function loadAnalytics(now = new Date()): Promise<PipelineAnalytics> {
  const supabase = await createClient();
  const since90 = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const since180 = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  const [events, leads] = await Promise.all([
    supabase
      .from("crm_lead_events")
      .select("lead_id, to_stage, created_at")
      .eq("type", "stage_change")
      .gte("created_at", since90)
      .limit(5000),
    supabase
      .from("crm_leads")
      .select("stage, origin, lost_reason, monthly_value_cents, contract_status, created_at, stage_changed_at")
      .or(`created_at.gte.${since180},stage_changed_at.gte.${since180}`)
      .limit(2000),
  ]);
  if (events.error) throw new Error(`Falha ao ler eventos: ${events.error.message}`);
  if (leads.error) throw new Error(`Falha ao ler leads: ${leads.error.message}`);
  const rows = (leads.data ?? []).map(
    (l) => ({ ...l, monthly_value_cents: l.monthly_value_cents === null ? null : toCents(l.monthly_value_cents as number) }) as AnalyticsLead,
  );
  return {
    stages: stageCounts((events.data ?? []) as { lead_id: string; to_stage: string | null; created_at: string }[], now),
    lost: lostReasons(rows, now),
    origins: originStats(rows, now),
  };
}
