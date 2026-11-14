/**
 * Cálculos da tela Rotina (puros, testáveis). Datas de calendário em ISO no fuso de São Paulo.
 */
import { addDays, startOfWeek, todayISO, type ISODate } from "@/lib/dates";

// ------------------------------------------------------------------ tarefas

export interface TaskLite {
  id: string;
  title: string;
  due_on: string | null;
  status: "todo" | "done" | "dropped";
  moves_revenue: boolean;
  priority: number;
  completed_at: string | null;
}

export type TaskBucket = "hoje" | "semana" | "backlog";

/**
 * Hoje = atrasadas + vencendo hoje. Semana = próximos 7 dias. Backlog = sem prazo ou mais longe.
 * Dentro de cada grupo: faturamento primeiro, depois prazo, depois prioridade (1 = alta).
 */
export function bucketTasks<T extends TaskLite>(tasks: readonly T[], today: ISODate): Record<TaskBucket, T[]> {
  const out: Record<TaskBucket, T[]> = { hoje: [], semana: [], backlog: [] };
  const weekEnd = addDays(today, 7);
  for (const t of tasks) {
    if (t.status !== "todo") continue;
    if (t.due_on && t.due_on <= today) out.hoje.push(t);
    else if (t.due_on && t.due_on <= weekEnd) out.semana.push(t);
    else out.backlog.push(t);
  }
  const sort = (a: T, b: T) =>
    Number(b.moves_revenue) - Number(a.moves_revenue) ||
    (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") ||
    a.priority - b.priority ||
    a.title.localeCompare(b.title, "pt-BR");
  for (const k of Object.keys(out) as TaskBucket[]) out[k].sort(sort);
  return out;
}

export function isOverdue(t: Pick<TaskLite, "due_on" | "status">, today: ISODate): boolean {
  return t.status === "todo" && !!t.due_on && t.due_on < today;
}

// ------------------------------------------------------------------ hábitos

export interface HeatCell {
  date: ISODate;
  /** 0..1 — fração dos hábitos ativos feitos no dia (0 = nada). */
  level: number;
  count: number;
  future: boolean;
}

/**
 * Grade de N semanas (colunas seg→dom), terminando na semana de hoje. Dias depois de hoje = `future`.
 * `logsByDate`: quantos hábitos foram feitos em cada dia.
 */
export function heatmapWeeks(
  logsByDate: ReadonlyMap<ISODate, number>,
  today: ISODate,
  activeHabits: number,
  weeks = 12,
): HeatCell[][] {
  const firstMonday = addDays(startOfWeek(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(firstMonday, w * 7 + d);
      const count = logsByDate.get(date) ?? 0;
      const level = activeHabits > 0 ? Math.min(count / activeHabits, 1) : count > 0 ? 1 : 0;
      return { date, count, level, future: date > today };
    }),
  );
}

/** Últimos N dias (do mais antigo para hoje). */
export function lastDays(today: ISODate, n = 7): ISODate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

// ------------------------------------------------------------------ tempo

export interface TimeEntryLite {
  id: string;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  is_focus: boolean;
}

/** Minutos de uma entrada (aberta = até agora). */
export function entryMinutes(e: Pick<TimeEntryLite, "started_at" | "ended_at">, now: Date): number {
  const end = e.ended_at ? new Date(e.ended_at) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(e.started_at).getTime()) / 60_000));
}

/** Minutos de foco por dia (dia do início, em SP) nos últimos N dias. */
export function minutesByDay(entries: readonly TimeEntryLite[], today: ISODate, now: Date, days = 7) {
  const range = lastDays(today, days);
  const map = new Map<ISODate, number>(range.map((d) => [d, 0]));
  for (const e of entries) {
    if (!e.is_focus) continue;
    const day = todayISO(new Date(e.started_at));
    if (map.has(day)) map.set(day, map.get(day)! + entryMinutes(e, now));
  }
  return range.map((date) => ({ date, minutes: map.get(date)! }));
}

/**
 * Minutos por rótulo numa janela de dias (maiores primeiro). "Site" e "site" somam juntos
 * (mostra a grafia que apareceu primeiro). Sem rótulo = "Sem rótulo".
 */
export function minutesByLabel(entries: readonly TimeEntryLite[], from: ISODate, today: ISODate, now: Date) {
  const map = new Map<string, { label: string; minutes: number }>();
  for (const e of entries) {
    const day = todayISO(new Date(e.started_at));
    if (day < from || day > today) continue;
    const label = e.label?.trim() || "Sem rótulo";
    const key = label.toLocaleLowerCase("pt-BR");
    const cur = map.get(key) ?? { label, minutes: 0 };
    cur.minutes += entryMinutes(e, now);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}
