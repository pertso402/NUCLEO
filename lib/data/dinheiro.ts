import "server-only";
import { addMonths, endOfMonth, startOfMonth, type ISODate } from "@/lib/dates";
import { lastMonthsSeries, type MonthTotals, type MoneyKind, type TxStatus } from "@/lib/metrics/money-report";
import { toCents, type Cents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface CategoryOption {
  id: string;
  name: string;
  kind: MoneyKind;
}

export interface Transaction {
  id: string;
  occurred_on: ISODate;
  amount_cents: Cents;
  kind: MoneyKind;
  category_id: string | null;
  description: string | null;
  counterparty: string | null;
  source: string;
  status: TxStatus;
}

export interface DinheiroData {
  categories: CategoryOption[];
  /** Todos os lançamentos do mês (inclusive pendentes), mais recentes primeiro. */
  transactions: Transaction[];
  /** 12 meses terminando no mês escolhido (só confirmados, via `v_month_totals`). */
  series: MonthTotals[];
  /** Marco de receita do mês (ativo, `revenue_month`) para a linha de meta no gráfico acumulado. */
  monthTarget: { title: string; targetCents: Cents } | null;
}

/** Dados da tela Dinheiro para o usuário logado (RLS filtra). */
export async function loadDinheiro(month: ISODate): Promise<DinheiroData> {
  const supabase = await createClient();
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  const [cats, txs, totals, ms] = await Promise.all([
    supabase.from("categories").select("id, name, kind").eq("archived", false).order("name"),
    supabase
      .from("transactions")
      .select("id, occurred_on, amount_cents, kind, category_id, description, counterparty, source, status")
      .gte("occurred_on", start)
      .lte("occurred_on", end)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("v_month_totals")
      .select("month, income_cents, expense_cents")
      .gte("month", addMonths(month, -11))
      .lte("month", start),
    supabase
      .from("milestones")
      .select("title, target_cents, period_start, period_end")
      .eq("status", "active")
      .eq("metric", "revenue_month")
      .order("position", { ascending: true }),
  ]);
  for (const r of [cats, txs, totals, ms]) {
    if (r.error) throw new Error(`Falha ao ler dados de Dinheiro: ${r.error.message}`);
  }

  return {
    categories: (cats.data ?? []) as CategoryOption[],
    transactions: (txs.data ?? []).map((t) => ({ ...t, amount_cents: toCents(t.amount_cents) }) as Transaction),
    series: lastMonthsSeries(totals.data ?? [], start),
    monthTarget: pickMonthTarget(ms.data ?? [], start, end),
  };
}

/** Primeiro marco mensal de receita que vale para o mês (período nulo = todo mês). */
function pickMonthTarget(
  rows: { title: string; target_cents: string | number; period_start: string | null; period_end: string | null }[],
  start: ISODate,
  end: ISODate,
): DinheiroData["monthTarget"] {
  const m = rows.find((r) => (!r.period_start || r.period_start <= end) && (!r.period_end || r.period_end >= start));
  return m ? { title: m.title, targetCents: toCents(m.target_cents) } : null;
}
