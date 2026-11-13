/**
 * Valor atual de um marco a partir dos lançamentos (função pura).
 * O banco devolve as linhas; aqui só se soma — sempre em centavos.
 */
import { toCents, type Cents } from "@/lib/money";
import type { ISODate } from "@/lib/dates";
import type { Period } from "@/lib/metrics/pace";

export type MilestoneMetric = "revenue_month" | "revenue_cumulative" | "mrr" | "net_month";

export interface MoneyRow {
  occurred_on: ISODate;
  amount_cents: number | string;
  kind: "income" | "expense";
}

/** Intervalo de datas que precisa ser buscado no banco para a métrica. `from` null = desde sempre. */
export function metricDateRange(metric: MilestoneMetric, period: Period): { from: ISODate | null; to: ISODate } {
  if (metric === "revenue_cumulative") return { from: null, to: period.end };
  return { from: period.start, to: period.end };
}

/**
 * Soma as linhas conforme a métrica. Espera só lançamentos `confirmed`.
 * `mrr` depende do pipeline (Fase 3); até lá vale 0.
 */
export function computeMetricValue(metric: MilestoneMetric, rows: readonly MoneyRow[], period: Period): Cents {
  const { from, to } = metricDateRange(metric, period);
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.occurred_on > to) continue;
    if (from !== null && r.occurred_on < from) continue;
    const v = toCents(r.amount_cents);
    if (r.kind === "income") income += v;
    else expense += v;
  }
  switch (metric) {
    case "revenue_month":
    case "revenue_cumulative":
      return income;
    case "net_month":
      return income - expense;
    case "mrr":
      return 0;
  }
}

export const METRIC_LABEL: Record<MilestoneMetric, string> = {
  revenue_month: "Receita do mês",
  revenue_cumulative: "Receita acumulada",
  mrr: "Mensalidades ativas",
  net_month: "Saldo do mês",
};
