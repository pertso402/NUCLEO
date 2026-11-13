/**
 * Relatórios da tela Dinheiro (ARCHITECTURE §7.2). Funções puras, sem banco:
 * recebem linhas já lidas e devolvem séries prontas para a UI. Tudo em centavos inteiros.
 */
import { addDays, addMonths, endOfMonth, monthKey, startOfMonth, type ISODate } from "@/lib/dates";
import { sumCents, toCents, type Cents } from "@/lib/money";

export type MoneyKind = "income" | "expense";
export type TxStatus = "confirmed" | "pending_review";

export interface TxRow {
  occurred_on: ISODate;
  amount_cents: Cents;
  kind: MoneyKind;
  category_id: string | null;
  status: TxStatus;
}

export interface MonthTotals {
  month: ISODate; // 1º dia
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents;
}

/** Totais do mês. Só lançamentos confirmados contam (mesma regra das views). */
export function monthTotals(rows: readonly TxRow[], month: ISODate): MonthTotals {
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const incomeCents = sumCents(confirmed.filter((r) => r.kind === "income").map((r) => r.amount_cents));
  const expenseCents = sumCents(confirmed.filter((r) => r.kind === "expense").map((r) => r.amount_cents));
  return { month: startOfMonth(month), incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

/**
 * Últimos `count` meses terminando em `endMonth`, em ordem cronológica, com zero nos meses sem dado.
 * `rows` vem de `v_month_totals` (bigint pode chegar como string).
 */
export function lastMonthsSeries(
  rows: readonly { month: string; income_cents: string | number; expense_cents: string | number }[],
  endMonth: ISODate,
  count = 12,
): MonthTotals[] {
  const byKey = new Map(rows.map((r) => [monthKey(r.month), r]));
  const out: MonthTotals[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonths(endMonth, -i);
    const r = byKey.get(monthKey(month));
    const incomeCents = toCents(r?.income_cents ?? 0);
    const expenseCents = toCents(r?.expense_cents ?? 0);
    out.push({ month, incomeCents, expenseCents, netCents: incomeCents - expenseCents });
  }
  return out;
}

export interface CumulativePoint {
  date: ISODate;
  /** null depois de "hoje" (a linha para onde o mês ainda não chegou). */
  cents: Cents | null;
}

/** Receita acumulada dia a dia no mês. Dias futuros ficam null. */
export function cumulativeIncome(rows: readonly TxRow[], month: ISODate, today: ISODate): CumulativePoint[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const perDay = new Map<ISODate, Cents>();
  for (const r of rows) {
    if (r.kind !== "income" || r.status !== "confirmed") continue;
    if (r.occurred_on < start || r.occurred_on > end) continue;
    perDay.set(r.occurred_on, (perDay.get(r.occurred_on) ?? 0) + r.amount_cents);
  }
  const out: CumulativePoint[] = [];
  let acc = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    acc += perDay.get(d) ?? 0;
    out.push({ date: d, cents: d > today ? null : acc });
  }
  return out;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  totalCents: Cents;
  count: number;
  /** Fração do total do tipo (0–1). */
  share: number;
}

/** Quebra por categoria de um tipo, do maior para o menor. */
export function categoryBreakdown(
  rows: readonly TxRow[],
  kind: MoneyKind,
  names: ReadonlyMap<string, string>,
): CategorySlice[] {
  const acc = new Map<string | null, { total: Cents; count: number }>();
  for (const r of rows) {
    if (r.kind !== kind || r.status !== "confirmed") continue;
    const cur = acc.get(r.category_id) ?? { total: 0, count: 0 };
    acc.set(r.category_id, { total: cur.total + r.amount_cents, count: cur.count + 1 });
  }
  const grand = sumCents([...acc.values()].map((v) => v.total));
  return [...acc.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      name: (categoryId && names.get(categoryId)) || "Sem categoria",
      totalCents: v.total,
      count: v.count,
      share: grand > 0 ? v.total / grand : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, "pt-BR"));
}

/** Agrupa o extrato por dia (mais recente primeiro), mantendo a ordem de entrada dentro do dia. */
export function groupByDay<T extends { occurred_on: ISODate }>(rows: readonly T[]): { date: ISODate; items: T[] }[] {
  const groups = new Map<ISODate, T[]>();
  for (const r of rows) {
    const list = groups.get(r.occurred_on);
    if (list) list.push(r);
    else groups.set(r.occurred_on, [r]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, items }));
}
