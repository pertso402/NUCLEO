import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export interface HighlightMilestone {
  milestone: { id: string; title: string; metricLabel: string; deadline: string | null };
  pace: PaceResult;
}

/**
 * Marco em destaque (ativo, menor `position`) com o ritmo calculado agora.
 * - Com o client da sessão: o RLS já filtra o usuário (`userId` opcional).
 * - Com o client admin (ingest/cron): passe `userId` — o service_role ignora o RLS.
 */
export async function loadHighlightMilestone(
  supabase: SupabaseClient,
  opts: { userId?: string; now?: Date } = {},
): Promise<HighlightMilestone | null> {
  const now = opts.now ?? new Date();
  let mq = supabase
    .from("milestones")
    .select("id, title, metric, target_cents, period_start, period_end, deadline")
    .eq("status", "active");
  if (opts.userId) mq = mq.eq("user_id", opts.userId);
  const { data: m, error } = await mq
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler marco: ${error.message}`);
  if (!m) return null;

  const metric = m.metric as MilestoneMetric;
  const period = resolvePeriod(m.period_start, m.period_end, todayISO(now));
  const range = metricDateRange(metric, period);

  let tq = supabase
    .from("transactions")
    .select("occurred_on, amount_cents, kind")
    .eq("status", "confirmed")
    .lte("occurred_on", range.to);
  if (opts.userId) tq = tq.eq("user_id", opts.userId);
  if (range.from) tq = tq.gte("occurred_on", range.from);
  if (metric === "revenue_month" || metric === "revenue_cumulative") tq = tq.eq("kind", "income");

  const { data: rows, error: txError } = await tq;
  if (txError) throw new Error(`Falha ao ler lançamentos: ${txError.message}`);

  const pace = computePace({
    currentCents: computeMetricValue(metric, (rows ?? []) as MoneyRow[], period),
    targetCents: toCents(m.target_cents),
    period,
    now,
  });
  return {
    milestone: { id: m.id, title: m.title, metricLabel: METRIC_LABEL[metric], deadline: m.deadline },
    pace,
  };
}
