/**
 * Números da semana (seg–dom) para a revisão semanal. Puro, testável.
 * Dinheiro em centavos; datas ISO em São Paulo.
 */
import { addDays, todayISO, weekday, type ISODate } from "@/lib/dates";
import { entryMinutes } from "@/lib/metrics/routine";

export interface WeekNumbers {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  focusMinutes: number;
  tasksDone: number;
  revenueTasksDone: number;
  habitsDone: number;
  /** Soma das metas semanais dos hábitos ativos (diário = 7). */
  habitsTarget: number;
  /** Média dos scores gravados na semana (null se nenhum). */
  avgScore: number | null;
  reviewedDays: number;
}

export interface WeekRows {
  transactions: { kind: "income" | "expense"; amount_cents: number }[];
  timeEntries: { started_at: string; ended_at: string | null; is_focus: boolean }[];
  tasksDone: { moves_revenue: boolean }[];
  habitLogs: unknown[];
  habits: { target_per_week: number }[];
  reviews: { score: number | null; win: string | null; lesson: string | null }[];
}

export function weekNumbers(rows: WeekRows, now: Date): WeekNumbers {
  const income = rows.transactions.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount_cents), 0);
  const expense = rows.transactions.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount_cents), 0);
  const scores = rows.reviews.map((r) => r.score).filter((s): s is number => typeof s === "number");
  return {
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    focusMinutes: rows.timeEntries.filter((e) => e.is_focus).reduce((s, e) => s + entryMinutes(e, now), 0),
    tasksDone: rows.tasksDone.length,
    revenueTasksDone: rows.tasksDone.filter((t) => t.moves_revenue).length,
    habitsDone: rows.habitLogs.length,
    habitsTarget: rows.habits.reduce((s, h) => s + Math.min(Math.max(Number(h.target_per_week), 1), 7), 0),
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    reviewedDays: rows.reviews.filter((r) => r.win || r.lesson).length,
  };
}

export type Trend = "up" | "down" | "same";

/** Variação de um número contra a semana anterior (null quando não dá pra comparar). */
export function delta(cur: number | null, prev: number | null): { diff: number; trend: Trend } | null {
  if (cur === null || prev === null) return null;
  const diff = cur - prev;
  return { diff, trend: diff > 0 ? "up" : diff < 0 ? "down" : "same" };
}

/**
 * Semana que a tela de revisão abre por padrão: sábado e domingo revisam a semana atual;
 * de segunda a sexta, a semana passada (a que acabou de fechar).
 */
export function defaultReviewWeek(today: ISODate): ISODate {
  const wd = weekday(today); // 0 dom … 6 sáb
  const monday = addDays(today, wd === 0 ? -6 : 1 - wd);
  return wd === 0 || wd === 6 ? monday : addDays(monday, -7);
}

/** "09/11 – 15/11". */
export function weekLabel(weekStart: ISODate): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)} – ${end.slice(8, 10)}/${end.slice(5, 7)}`;
}

/** É segunda-feira? (week_start precisa ser segunda — constraint do banco.) */
export function isMonday(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && weekday(iso) === 1;
}

/** A semana ainda está em andamento? */
export function isCurrentWeek(weekStart: ISODate, now: Date): boolean {
  const today = todayISO(now);
  return today >= weekStart && today <= addDays(weekStart, 6);
}
