import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { computePace, resolvePeriod, type PaceResult } from "@/lib/metrics/pace";
import {
  computeMetricValue,
  metricDateRange,
  METRIC_LABEL,
  type MilestoneMetric,
  type MoneyRow,
} from "@/lib/metrics/milestone-value";
import { toCents } from "@/lib/money";
import type { HeroMilestone } from "@/components/hud/MilestoneHero";

export interface HighlightMilestone {
  milestone: HeroMilestone & { id: string };
  pace: PaceResult;
}

/** Marco em destaque (ativo, menor `position`) com o ritmo calculado agora. RLS garante que é do usuário. */
export async function getHighlightMilestone(now: Date = new Date()): Promise<HighlightMilestone | null> {
  const supabase = await createClient();
  const { data: m, error } = await supabase
    .from("milestones")
    .select("id, title, metric, target_cents, period_start, period_end, deadline")
    .eq("status", "active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler marco: ${error.message}`);
  if (!m) return null;

  const metric = m.metric as MilestoneMetric;
  const period = resolvePeriod(m.period_start, m.period_end, todayISO(now));
  const range = metricDateRange(metric, period);

  let query = supabase
    .from("transactions")
    .select("occurred_on, amount_cents, kind")
    .eq("status", "confirmed")
    .lte("occurred_on", range.to);
  if (range.from) query = query.gte("occurred_on", range.from);
  if (metric === "revenue_month" || metric === "revenue_cumulative") query = query.eq("kind", "income");

  const { data: rows, error: txError } = await query;
  if (txError) throw new Error(`Falha ao ler lançamentos: ${txError.message}`);

  const current = computeMetricValue(metric, (rows ?? []) as MoneyRow[], period);
  const pace = computePace({
    currentCents: current,
    targetCents: toCents(m.target_cents),
    period,
    now,
  });

  return {
    milestone: { id: m.id, title: m.title, metricLabel: METRIC_LABEL[metric], deadline: m.deadline },
    pace,
  };
}
