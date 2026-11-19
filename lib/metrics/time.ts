/**
 * Análise de tempo (puro, testável): dia/semana/mês, comparação com o período anterior,
 * por projeto, por dia, evolução semanal e mapa de horários. Datas ISO em São Paulo.
 * Uma sessão conta no dia (e na hora) em que começou; sessões abertas contam até `now`.
 */
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek, todayISO, zonedParts, type ISODate } from "@/lib/dates";

export interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_focus: boolean;
  project_id: string | null;
  task_id: string | null;
  kind: "timer" | "pomodoro" | "manual";
  label: string | null;
}

export type Granularity = "day" | "week" | "month";

export interface Range {
  start: ISODate;
  end: ISODate;
}

export function entryMinutes(e: Pick<TimeEntryRow, "started_at" | "ended_at">, now: Date): number {
  const end = e.ended_at ? new Date(e.ended_at) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(e.started_at).getTime()) / 60_000));
}

export const entryDay = (e: Pick<TimeEntryRow, "started_at">): ISODate => todayISO(new Date(e.started_at));

/** Período que contém `ref`: o dia, a semana (seg–dom) ou o mês. */
export function periodRange(g: Granularity, ref: ISODate): Range {
  if (g === "day") return { start: ref, end: ref };
  if (g === "week") {
    const start = startOfWeek(ref);
    return { start, end: addDays(start, 6) };
  }
  return { start: startOfMonth(ref), end: endOfMonth(ref) };
}

/** O período imediatamente anterior, do mesmo tipo (ontem, semana passada, mês passado). */
export function previousRange(g: Granularity, r: Range): Range {
  if (g === "day") return periodRange("day", addDays(r.start, -1));
  if (g === "week") return periodRange("week", addDays(r.start, -7));
  return periodRange("month", addMonths(r.start, -1));
}

/** Mesmo período deslocado `n` vezes (navegação ← →). */
export function shiftRange(g: Granularity, r: Range, n: number): Range {
  if (g === "day") return periodRange("day", addDays(r.start, n));
  if (g === "week") return periodRange("week", addDays(r.start, 7 * n));
  return periodRange("month", addMonths(r.start, n));
}

export function daysIn(r: Range): ISODate[] {
  const out: ISODate[] = [];
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) out.push(d);
  return out;
}

const inRange = (d: ISODate, r: Range) => d >= r.start && d <= r.end;

export interface PeriodSummary {
  totalMinutes: number;
  sessions: number;
  pomodoros: number;
  /** Dias com algum foco. */
  activeDays: number;
  /** Média por dia com foco. */
  avgPerActiveDay: number;
  bestDay: { date: ISODate; minutes: number } | null;
  byProject: { projectId: string | null; minutes: number }[];
  byDay: { date: ISODate; minutes: number; byProject: Record<string, number> }[];
}

/** Resumo do período (só foco). Chave de projeto "none" = sem projeto. */
export function summarize(entries: readonly TimeEntryRow[], r: Range, now: Date): PeriodSummary {
  const days = daysIn(r);
  const byDay = new Map(days.map((d) => [d, { date: d, minutes: 0, byProject: {} as Record<string, number> }]));
  const byProject = new Map<string | null, number>();
  let total = 0;
  let sessions = 0;
  let pomodoros = 0;
  for (const e of entries) {
    if (!e.is_focus) continue;
    const d = entryDay(e);
    if (!inRange(d, r)) continue;
    const m = entryMinutes(e, now);
    total += m;
    sessions++;
    if (e.kind === "pomodoro") pomodoros++;
    const key = e.project_id ?? "none";
    const slot = byDay.get(d)!;
    slot.minutes += m;
    slot.byProject[key] = (slot.byProject[key] ?? 0) + m;
    byProject.set(e.project_id, (byProject.get(e.project_id) ?? 0) + m);
  }
  const series = [...byDay.values()];
  const active = series.filter((d) => d.minutes > 0);
  const best = active.reduce<PeriodSummary["bestDay"]>((b, d) => (!b || d.minutes > b.minutes ? { date: d.date, minutes: d.minutes } : b), null);
  return {
    totalMinutes: total,
    sessions,
    pomodoros,
    activeDays: active.length,
    avgPerActiveDay: active.length ? Math.round(total / active.length) : 0,
    bestDay: best,
    byProject: [...byProject.entries()]
      .map(([projectId, minutes]) => ({ projectId, minutes }))
      .sort((a, b) => b.minutes - a.minutes),
    byDay: series,
  };
}

/** Variação contra o período anterior. `pct` null quando o anterior foi zero. */
export function compare(cur: number, prev: number): { diff: number; pct: number | null; trend: "up" | "down" | "same" } {
  const diff = cur - prev;
  return { diff, pct: prev > 0 ? diff / prev : null, trend: diff > 0 ? "up" : diff < 0 ? "down" : "same" };
}

/** Minutos por semana (seg–dom) nas últimas `weeks` semanas até a de `today` (mais antiga primeiro). */
export function weeklySeries(entries: readonly TimeEntryRow[], today: ISODate, now: Date, weeks = 12) {
  const last = startOfWeek(today);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(last, -7 * (weeks - 1 - i)));
  const map = new Map(starts.map((s) => [s, 0]));
  for (const e of entries) {
    if (!e.is_focus) continue;
    const w = startOfWeek(entryDay(e));
    if (map.has(w)) map.set(w, map.get(w)! + entryMinutes(e, now));
  }
  return starts.map((weekStart) => ({ weekStart, minutes: map.get(weekStart)! }));
}

/** Minutos por mês nos últimos `months` meses até o de `today`. */
export function monthlySeries(entries: readonly TimeEntryRow[], today: ISODate, now: Date, months = 6) {
  const cur = startOfMonth(today);
  const starts = Array.from({ length: months }, (_, i) => addMonths(cur, -(months - 1 - i)));
  const map = new Map(starts.map((s) => [s, 0]));
  for (const e of entries) {
    if (!e.is_focus) continue;
    const m = startOfMonth(entryDay(e));
    if (map.has(m)) map.set(m, map.get(m)! + entryMinutes(e, now));
  }
  return starts.map((month) => ({ month, minutes: map.get(month)! }));
}

/**
 * Mapa de horários: minutos de foco por dia da semana (0 seg … 6 dom) × hora (0–23) em São Paulo.
 * A sessão é distribuída minuto a minuto pelas horas que atravessa (passo de 5 min).
 */
export function hourHeatmap(entries: readonly TimeEntryRow[], r: Range, now: Date): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const e of entries) {
    if (!e.is_focus || !inRange(entryDay(e), r)) continue;
    const start = new Date(e.started_at).getTime();
    const end = (e.ended_at ? new Date(e.ended_at) : now).getTime();
    for (let t = start; t < end; t += 5 * 60_000) {
      const p = zonedParts(new Date(t));
      const wd = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7; // seg = 0
      grid[wd]![p.hour]! += Math.min(5, (end - t) / 60_000);
    }
  }
  return grid.map((row) => row.map((m) => Math.round(m)));
}

/** Minutos registrados por tarefa (estimado × realizado). */
export function minutesByTask(entries: readonly TimeEntryRow[], now: Date): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (!e.task_id || !e.is_focus) continue;
    out.set(e.task_id, (out.get(e.task_id) ?? 0) + entryMinutes(e, now));
  }
  return out;
}

/** Dias seguidos (até hoje ou ontem) com pelo menos `minMinutes` de foco. */
export function focusStreak(entries: readonly TimeEntryRow[], today: ISODate, now: Date, minMinutes = 30): number {
  const perDay = new Map<ISODate, number>();
  for (const e of entries) if (e.is_focus) perDay.set(entryDay(e), (perDay.get(entryDay(e)) ?? 0) + entryMinutes(e, now));
  let d = (perDay.get(today) ?? 0) >= minMinutes ? today : addDays(today, -1);
  let n = 0;
  while ((perDay.get(d) ?? 0) >= minMinutes) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** "3h20" / "45min" / "0min". */
export function fmtHours(minutes: number): string {
  const v = Math.max(0, Math.round(minutes));
  if (v < 60) return `${v}min`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}
