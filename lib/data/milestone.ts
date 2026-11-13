import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayISO, type ISODate } from "@/lib/dates";
import { computePace, resolvePeriod, type PaceResult } from "@/lib/metrics/pace";
import {
  computeMetricValue,
  metricDateRange,
  METRIC_LABEL,
  type MilestoneMetric,
  type MoneyRow,
} from "@/lib/metrics/milestone-value";
import { achievementDays } from "@/lib/metrics/milestones";
import { toCents, type Cents } from "@/lib/money";

/**
 * Leitura e regras de marcos no servidor.
 * - Com o client da sessão: o RLS já filtra o usuário (`userId` opcional).
 * - Com o client admin (ingest/cron): passe `userId` — o service_role ignora o RLS.
 */
interface Opts {
  userId?: string;
  now?: Date;
}

export type MilestoneStatus = "active" | "achieved" | "archived";

export interface MilestoneRow {
  id: string;
  title: string;
  metric: MilestoneMetric;
  target_cents: Cents;
  period_start: ISODate | null;
  period_end: ISODate | null;
  deadline: ISODate | null;
  status: MilestoneStatus;
  achieved_at: string | null;
  position: number;
  created_at: string;
}

const SELECT = "id, title, metric, target_cents, period_start, period_end, deadline, status, achieved_at, position, created_at";

function normalize(r: Record<string, unknown>): MilestoneRow {
  return { ...(r as unknown as MilestoneRow), target_cents: toCents(r.target_cents as string | number) };
}

/** Valor atual de um marco (soma dos lançamentos confirmados no período da métrica). */
export async function milestoneCurrentCents(
  supabase: SupabaseClient,
  m: Pick<MilestoneRow, "metric" | "period_start" | "period_end">,
  opts: Opts = {},
): Promise<Cents> {
  if (m.metric === "mrr") return 0; // depende do pipeline (Fase 3)
  const now = opts.now ?? new Date();
  const period = resolvePeriod(m.period_start, m.period_end, todayISO(now));
  const range = metricDateRange(m.metric, period);

  let tq = supabase
    .from("transactions")
    .select("occurred_on, amount_cents, kind")
    .eq("status", "confirmed")
    .lte("occurred_on", range.to);
  if (opts.userId) tq = tq.eq("user_id", opts.userId);
  if (range.from) tq = tq.gte("occurred_on", range.from);
  if (m.metric === "revenue_month" || m.metric === "revenue_cumulative") tq = tq.eq("kind", "income");

  const { data: rows, error } = await tq;
  if (error) throw new Error(`Falha ao ler lançamentos: ${error.message}`);
  return computeMetricValue(m.metric, (rows ?? []) as MoneyRow[], period);
}

export interface HighlightMilestone {
  milestone: { id: string; title: string; metricLabel: string; deadline: string | null };
  pace: PaceResult;
}

/** Marco em destaque (ativo, menor `position`) com o ritmo calculado agora. */
export async function loadHighlightMilestone(
  supabase: SupabaseClient,
  opts: Opts = {},
): Promise<HighlightMilestone | null> {
  const now = opts.now ?? new Date();
  let mq = supabase.from("milestones").select(SELECT).eq("status", "active");
  if (opts.userId) mq = mq.eq("user_id", opts.userId);
  const { data, error } = await mq
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler marco: ${error.message}`);
  if (!data) return null;
  const m = normalize(data);

  const pace = computePace({
    currentCents: await milestoneCurrentCents(supabase, m, { ...opts, now }),
    targetCents: m.target_cents,
    period: resolvePeriod(m.period_start, m.period_end, todayISO(now)),
    now,
  });
  return {
    milestone: { id: m.id, title: m.title, metricLabel: METRIC_LABEL[m.metric], deadline: m.deadline },
    pace,
  };
}

export interface ActiveMilestone extends MilestoneRow {
  currentCents: Cents;
  pct: number;
}

export interface MilestonesOverview {
  active: ActiveMilestone[];
  /** Batidos, do mais recente para o mais antigo, com quantos dias levou. */
  achieved: (MilestoneRow & { days: number })[];
  archived: MilestoneRow[];
}

/** Todos os marcos, com o progresso dos ativos (tela Marcos). */
export async function loadMilestonesOverview(supabase: SupabaseClient, opts: Opts = {}): Promise<MilestonesOverview> {
  const now = opts.now ?? new Date();
  let q = supabase.from("milestones").select(SELECT);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q.order("position", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(`Falha ao ler marcos: ${error.message}`);
  const rows = (data ?? []).map(normalize);

  const active = await Promise.all(
    rows
      .filter((m) => m.status === "active")
      .map(async (m) => {
        const currentCents = await milestoneCurrentCents(supabase, m, { ...opts, now });
        return { ...m, currentCents, pct: m.target_cents > 0 ? currentCents / m.target_cents : 0 };
      }),
  );
  const achieved = rows
    .filter((m): m is MilestoneRow & { achieved_at: string } => m.status === "achieved" && m.achieved_at !== null)
    .sort((a, b) => (a.achieved_at < b.achieved_at ? 1 : -1))
    .map((m) => ({ ...m, days: achievementDays(m) }));
  return { active, achieved, archived: rows.filter((m) => m.status === "archived") };
}

export interface Achievement {
  id: string;
  title: string;
  targetCents: Cents;
  currentCents: Cents;
  achievedAt: string;
  days: number;
}

/**
 * Marca como batidos os marcos ativos que chegaram na meta. Devolve só os que bateram AGORA.
 * Chamado depois de toda mudança em lançamentos ou marcos (ingest, tela Dinheiro, tela Marcos).
 * O `update ... where status = 'active'` evita marcar duas vezes em chamadas simultâneas.
 */
export async function syncAchievements(supabase: SupabaseClient, opts: Opts = {}): Promise<Achievement[]> {
  const now = opts.now ?? new Date();
  let q = supabase.from("milestones").select(SELECT).eq("status", "active");
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler marcos: ${error.message}`);

  const out: Achievement[] = [];
  for (const m of (data ?? []).map(normalize)) {
    if (m.metric === "mrr") continue;
    const currentCents = await milestoneCurrentCents(supabase, m, { ...opts, now });
    if (currentCents < m.target_cents) continue;
    const achievedAt = now.toISOString();
    let uq = supabase
      .from("milestones")
      .update({ status: "achieved", achieved_at: achievedAt })
      .eq("id", m.id)
      .eq("status", "active");
    if (opts.userId) uq = uq.eq("user_id", opts.userId);
    const { data: updated, error: upError } = await uq.select("id");
    if (upError) throw new Error(`Falha ao marcar marco: ${upError.message}`);
    if (!updated?.length) continue;
    out.push({
      id: m.id,
      title: m.title,
      targetCents: m.target_cents,
      currentCents,
      achievedAt,
      days: achievementDays({ ...m, achieved_at: achievedAt }),
    });
  }
  return out;
}

/** Conquistas recentes (para a celebração aparecer em qualquer tela, uma vez por aparelho). */
export async function loadRecentAchievements(
  supabase: SupabaseClient,
  opts: Opts & { days?: number } = {},
): Promise<Achievement[]> {
  const now = opts.now ?? new Date();
  const since = addDays(todayISO(now), -(opts.days ?? 7));
  let q = supabase
    .from("milestones")
    .select(SELECT)
    .eq("status", "achieved")
    .gte("achieved_at", `${since}T00:00:00-03:00`);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q.order("achieved_at", { ascending: false });
  if (error) return []; // celebração é enfeite: nunca derruba a tela
  return (data ?? []).map(normalize).map((m) => ({
    id: m.id,
    title: m.title,
    targetCents: m.target_cents,
    currentCents: m.target_cents,
    achievedAt: m.achieved_at!,
    days: achievementDays({ ...m, achieved_at: m.achieved_at! }),
  }));
}
