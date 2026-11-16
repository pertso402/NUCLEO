import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, endOfMonth, todayISO } from "@/lib/dates";
import { loadHighlightMilestone } from "@/lib/data/milestone";
import {
  averageTicket,
  computeRates,
  dailyOutreachGoal,
  parseDefaultRates,
  reverseFunnel,
  type Rates,
  type ReverseFunnel,
} from "@/lib/metrics/funnel";
import { computePace } from "@/lib/metrics/pace";
import { toCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface FunnelData {
  /** Marco que o funil persegue: o de mensalidades (mrr) ativo; senão o marco em destaque. */
  milestone: {
    title: string;
    metric: string;
    currentCents: number;
    targetCents: number;
    remainingCents: number;
    bdLeft: number;
  } | null;
  rates: Rates;
  ticket: { ticketCents: number | null; sample: number; estimated: boolean };
  openProposals: number;
  /** null quando falta marco ou ticket. */
  funnel: ReverseFunnel | null;
  /** Meta de abordagens do dia (ARCHITECTURE §6.3): o funil se `auto_outreach_goal`, senão a manual. */
  dailyGoal: { value: number; auto: boolean };
}

export { dailyOutreachGoal };

type Ctx = { supabase: SupabaseClient; userId: string };

async function sessionCtx(): Promise<Ctx> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new Error("Sem sessão");
  return { supabase, userId: sub };
}

/** Tudo do funil reverso. Sem `ctx`: sessão do usuário; com `ctx` (cron/ingest): client admin + dono. */
export async function loadFunnel(now = new Date(), ctx?: Ctx): Promise<FunnelData> {
  const { supabase, userId } = ctx ?? (await sessionCtx());
  const today = todayISO(now);
  const since90 = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  const [settings, mrrMilestone, mrr, events, closed, proposals] = await Promise.all([
    supabase
      .from("settings")
      .select("default_conv_rates, default_ticket_cents, auto_outreach_goal, daily_outreach_goal")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("title, target_cents, period_start, period_end, deadline")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("metric", "mrr")
      .order("position")
      .limit(1)
      .maybeSingle(),
    supabase.from("v_mrr").select("mrr_cents").eq("user_id", userId).maybeSingle(),
    supabase
      .from("crm_lead_events")
      .select("lead_id, to_stage, created_at")
      .eq("user_id", userId)
      .eq("type", "stage_change")
      .gte("created_at", since90)
      .limit(5000),
    supabase
      .from("crm_leads")
      .select("monthly_value_cents, closed_at")
      .eq("user_id", userId)
      .eq("stage", "fechado")
      .not("monthly_value_cents", "is", null),
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("stage", "proposta"),
  ]);

  const rates = computeRates(
    (events.data ?? []) as { lead_id: string; to_stage: string | null; created_at: string }[],
    parseDefaultRates(settings.data?.default_conv_rates),
    now,
  );
  const ticket = averageTicket(
    (closed.data ?? []).map((c) => ({ monthly_value_cents: Number(c.monthly_value_cents), closed_at: c.closed_at as string | null })),
    settings.data?.default_ticket_cents ? toCents(settings.data.default_ticket_cents as number) : null,
    now,
  );
  const openProposals = proposals.count ?? 0;

  let milestone: FunnelData["milestone"] = null;
  if (mrrMilestone.data) {
    const m = mrrMilestone.data;
    const currentCents = toCents((mrr.data?.mrr_cents as number | undefined) ?? 0);
    const targetCents = toCents(m.target_cents as number);
    const end = (m.period_end as string | null) ?? (m.deadline as string | null) ?? endOfMonth(today);
    const start = (m.period_start as string | null) ?? today;
    const pace = computePace({ currentCents, targetCents, period: { start: start <= end ? start : addDays(end, -1), end }, now });
    milestone = {
      title: m.title as string,
      metric: "mrr",
      currentCents,
      targetCents,
      remainingCents: Math.max(targetCents - currentCents, 0),
      bdLeft: pace.bdLeft,
    };
  } else {
    const h = await loadHighlightMilestone(supabase, { userId, now });
    if (h) {
      milestone = {
        title: h.milestone.title,
        metric: h.milestone.metricLabel,
        currentCents: h.pace.currentCents,
        targetCents: h.pace.targetCents,
        remainingCents: h.pace.remainingCents,
        bdLeft: h.pace.bdLeft,
      };
    }
  }

  const funnel =
    milestone && ticket.ticketCents
      ? reverseFunnel({
          remainingCents: milestone.remainingCents,
          ticketCents: ticket.ticketCents,
          rates: { r1: rates.r1.rate, r2: rates.r2.rate, r3: rates.r3.rate, r4: rates.r4.rate },
          openProposals,
          bdLeft: milestone.bdLeft,
        })
      : null;

  return {
    milestone,
    rates,
    ticket,
    openProposals,
    funnel,
    dailyGoal: dailyOutreachGoal(
      settings.data?.auto_outreach_goal !== false,
      Number(settings.data?.daily_outreach_goal ?? 5),
      funnel,
    ),
  };
}
