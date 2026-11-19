import "server-only";
import { addDays, addMonths, dayInstantRange, startOfMonth, startOfWeek, todayISO, type ISODate } from "@/lib/dates";
import { DEFAULT_POMODORO, type PomodoroConfig } from "@/lib/metrics/pomodoro";
import { entryDay, entryMinutes, isCompletePomodoro, type TimeEntryRow } from "@/lib/metrics/time";
import type { ProjectColor, ProjectKind } from "@/lib/projects-palette";
import { createClient } from "@/lib/supabase/server";

/**
 * Dados do módulo de Produtividade (Fase P): projetos, tarefas por projeto, foco/pomodoro e análise de tempo.
 * Tudo com a sessão do usuário (RLS).
 */

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  status: "active" | "paused" | "done" | "archived";
  color: ProjectColor;
  description: string | null;
  lead_id: string | null;
  goal_id: string | null;
  weekly_hours_goal: number | null;
  deadline: ISODate | null;
  position: number;
}

export interface ProjectStats extends Project {
  openTasks: number;
  doneTasks: number;
  minutesWeek: number;
  minutesMonth: number;
  minutesTotal: number;
  lastActivity: string | null;
}

export interface WorkTask {
  id: string;
  title: string;
  notes: string | null;
  due_on: ISODate | null;
  status: "todo" | "doing" | "done" | "dropped";
  moves_revenue: boolean;
  priority: number;
  completed_at: string | null;
  goal_id: string | null;
  project_id: string | null;
  estimate_minutes: number | null;
  /** Minutos já registrados nessa tarefa. */
  trackedMinutes: number;
}

export interface OpenFocus {
  id: string;
  label: string | null;
  started_at: string;
  kind: TimeEntryRow["kind"];
  planned_minutes: number | null;
  project_id: string | null;
  task_id: string | null;
}

export const PROJECT_COLS = "id, name, kind, status, color, description, lead_id, goal_id, weekly_hours_goal, deadline, position";
const TASK_COLS =
  "id, title, notes, due_on, status, moves_revenue, priority, completed_at, goal_id, project_id, estimate_minutes";
export const ENTRY_COLS = "id, started_at, ended_at, is_focus, project_id, task_id, kind, label, planned_minutes";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const toProject = (r: Record<string, unknown>): Project => ({
  ...(r as unknown as Project),
  weekly_hours_goal: num(r.weekly_hours_goal),
});

async function supa() {
  return createClient();
}

/** Projetos (sem arquivados, a menos que `withArchived`). */
export async function loadProjects(withArchived = false): Promise<Project[]> {
  const supabase = await supa();
  let q = supabase.from("projects").select(PROJECT_COLS).order("position").order("created_at");
  if (!withArchived) q = q.neq("status", "archived");
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao ler projetos: ${error.message}`);
  return (data ?? []).map(toProject);
}

/** Projetos com números: tarefas abertas/feitas e horas na semana, no mês e no total. */
export async function loadProjectStats(now = new Date()): Promise<ProjectStats[]> {
  const supabase = await supa();
  const today = todayISO(now);
  const week = startOfWeek(today);
  const month = startOfMonth(today);
  const [projects, tasks, entries] = await Promise.all([
    loadProjects(),
    supabase.from("tasks").select("project_id, status").not("project_id", "is", null).limit(5000),
    supabase.from("time_entries").select("project_id, started_at, ended_at, is_focus").not("project_id", "is", null).limit(20000),
  ]);
  const out = new Map(
    projects.map((p) => [
      p.id,
      { ...p, openTasks: 0, doneTasks: 0, minutesWeek: 0, minutesMonth: 0, minutesTotal: 0, lastActivity: null as string | null },
    ]),
  );
  for (const t of tasks.data ?? []) {
    const s = out.get(t.project_id as string);
    if (!s) continue;
    if (t.status === "todo" || t.status === "doing") s.openTasks++;
    else if (t.status === "done") s.doneTasks++;
  }
  for (const e of entries.data ?? []) {
    const s = out.get(e.project_id as string);
    if (!s || !e.is_focus) continue;
    const m = entryMinutes(e as { started_at: string; ended_at: string | null }, now);
    const d = entryDay(e as { started_at: string });
    s.minutesTotal += m;
    if (d >= week) s.minutesWeek += m;
    if (d >= month) s.minutesMonth += m;
    if (!s.lastActivity || (e.started_at as string) > s.lastActivity) s.lastActivity = e.started_at as string;
  }
  return [...out.values()];
}

/** Tarefas abertas (+ feitas hoje), com o tempo já registrado em cada uma. */
export async function loadWorkTasks(now = new Date()): Promise<{ open: WorkTask[]; doneToday: WorkTask[] }> {
  const supabase = await supa();
  const { from, to } = dayInstantRange(todayISO(now));
  const [open, done] = await Promise.all([
    supabase.from("tasks").select(TASK_COLS).in("status", ["todo", "doing"]).order("due_on", { ascending: true, nullsFirst: false }).limit(500),
    supabase
      .from("tasks")
      .select(TASK_COLS)
      .eq("status", "done")
      .gte("completed_at", from.toISOString())
      .lt("completed_at", to.toISOString())
      .order("completed_at", { ascending: false }),
  ]);
  if (open.error) throw new Error(`Falha ao ler tarefas: ${open.error.message}`);
  const all = [...(open.data ?? []), ...(done.data ?? [])];
  const ids = all.map((t) => t.id as string);
  const tracked = new Map<string, number>();
  if (ids.length) {
    const { data } = await supabase.from("time_entries").select("task_id, started_at, ended_at").in("task_id", ids).limit(10000);
    for (const e of data ?? []) {
      tracked.set(e.task_id as string, (tracked.get(e.task_id as string) ?? 0) + entryMinutes(e as { started_at: string; ended_at: string | null }, now));
    }
  }
  const map = (r: Record<string, unknown>): WorkTask => ({
    ...(r as unknown as WorkTask),
    estimate_minutes: num(r.estimate_minutes),
    trackedMinutes: tracked.get(r.id as string) ?? 0,
  });
  return { open: (open.data ?? []).map(map), doneToday: (done.data ?? []).map(map) };
}

/** Foco em andamento + configuração do pomodoro + quanto já foi focado hoje (sessões fechadas). */
export async function loadFocus(now = new Date()): Promise<{
  open: OpenFocus | null;
  config: PomodoroConfig;
  todayMinutes: number;
  todayPomodoros: number;
  focusGoalMinutes: number;
}> {
  const supabase = await supa();
  const { from, to } = dayInstantRange(todayISO(now));
  const [open, settings, today] = await Promise.all([
    supabase.from("time_entries").select("id, label, started_at, kind, planned_minutes, project_id, task_id").is("ended_at", null).maybeSingle(),
    supabase
      .from("settings")
      .select("pomodoro_focus_minutes, pomodoro_short_break_minutes, pomodoro_long_break_minutes, pomodoro_cycles, daily_focus_minutes_goal")
      .maybeSingle(),
    supabase.from("time_entries").select("started_at, ended_at, is_focus, kind, planned_minutes").gte("started_at", from.toISOString()).lt("started_at", to.toISOString()),
  ]);
  const s = settings.data;
  // Só sessões fechadas: a aberta é somada ao vivo no cliente.
  const rows = (today.data ?? []).filter((e) => e.is_focus && e.ended_at);
  return {
    open: (open.data as OpenFocus | null) ?? null,
    config: s
      ? {
          focusMinutes: Number(s.pomodoro_focus_minutes),
          shortBreakMinutes: Number(s.pomodoro_short_break_minutes),
          longBreakMinutes: Number(s.pomodoro_long_break_minutes),
          cycles: Number(s.pomodoro_cycles),
        }
      : DEFAULT_POMODORO,
    focusGoalMinutes: s ? Number(s.daily_focus_minutes_goal) : 240,
    todayMinutes: rows.reduce((m, e) => m + entryMinutes(e as { started_at: string; ended_at: string | null }, now), 0),
    todayPomodoros: rows.filter((e) => isCompletePomodoro(e as Parameters<typeof isCompletePomodoro>[0])).length,
  };
}

/**
 * Sessões para a análise de tempo: desde o começo do mês de 6 meses atrás (cobre mês × mês anterior,
 * 12 semanas e 6 meses de evolução).
 */
export async function loadTimeEntries(now = new Date()): Promise<TimeEntryRow[]> {
  const supabase = await supa();
  const since = dayInstantRange(addDays(addMonths(startOfMonth(todayISO(now)), -6), 0)).from.toISOString();
  const { data, error } = await supabase
    .from("time_entries")
    .select(ENTRY_COLS)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(20000);
  if (error) throw new Error(`Falha ao ler o tempo: ${error.message}`);
  return (data ?? []) as TimeEntryRow[];
}
