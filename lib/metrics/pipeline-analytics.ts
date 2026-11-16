/**
 * Análises do pipeline (ARCHITECTURE §7.6): conversão por etapa, motivos de perda e origem que mais fecha.
 * Puro, testável. Dinheiro em centavos.
 */
import type { LeadOrigin, LostReason } from "./pipeline";

export interface AnalyticsLead {
  stage: string;
  origin: LeadOrigin;
  lost_reason: LostReason | null;
  monthly_value_cents: number | null;
  contract_status: "ativo" | "encerrado" | null;
  created_at: string;
  stage_changed_at: string;
}

const inWindow = (iso: string, now: Date, days: number) => now.getTime() - new Date(iso).getTime() <= days * 86_400_000;

/** Motivos de perda dos leads perdidos na janela (maior primeiro). */
export function lostReasons(leads: readonly AnalyticsLead[], now: Date, windowDays = 180) {
  const counts = new Map<LostReason, number>();
  let total = 0;
  for (const l of leads) {
    if (l.stage !== "perdido" || !l.lost_reason || !inWindow(l.stage_changed_at, now, windowDays)) continue;
    counts.set(l.lost_reason, (counts.get(l.lost_reason) ?? 0) + 1);
    total++;
  }
  return {
    total,
    items: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count, share: count / total }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}

export interface OriginStat {
  origin: LeadOrigin;
  leads: number;
  closed: number;
  /** fechados / leads da origem (0..1). */
  closeRate: number;
  /** Mensalidades dos contratos ativos vindos dessa origem. */
  mrrCents: number;
}

/**
 * Por origem, entre os leads criados na janela: quantos, quantos fecharam, taxa e MRR ativo.
 * Ordena por fechados, depois taxa, depois volume — "a origem que mais fecha" vem primeiro.
 */
export function originStats(leads: readonly AnalyticsLead[], now: Date, windowDays = 180): OriginStat[] {
  const map = new Map<LeadOrigin, OriginStat>();
  for (const l of leads) {
    if (!inWindow(l.created_at, now, windowDays)) continue;
    const s = map.get(l.origin) ?? { origin: l.origin, leads: 0, closed: 0, closeRate: 0, mrrCents: 0 };
    s.leads++;
    if (l.stage === "fechado") {
      s.closed++;
      if (l.contract_status === "ativo") s.mrrCents += Number(l.monthly_value_cents ?? 0);
    }
    map.set(l.origin, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, closeRate: s.leads ? s.closed / s.leads : 0 }))
    .sort((a, b) => b.closed - a.closed || b.closeRate - a.closeRate || b.leads - a.leads);
}
