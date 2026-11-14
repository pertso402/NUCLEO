import "server-only";
import { addDays, dayInstantRange, startOfWeek, type ISODate } from "@/lib/dates";
import type { TaskLite, TimeEntryLite } from "@/lib/metrics/routine";
import { createClient } from "@/lib/supabase/server";

export type RotinaTab = "tarefas" | "habitos" | "tempo";

export interface Task extends TaskLite {
  goal_id: string | null;
  notes: string | null;
}

export interface Habit {
  id: string;
  name: string;
  target_per_week: number;
  position: number;
  unit: "day" | "week";
  current_streak: number;
  best_streak: number;
}

export interface TasksData {
  open: Task[];
  /** Concluídas hoje (para o "feito hoje" no fim da lista). */
  doneToday: Task[];
}

export interface HabitsData {
  habits: Habit[];
  /** Logs das últimas 12 semanas: habit_id → datas feitas. */
  logs: Record<string, ISODate[]>;
}

export interface TimeData {
  /** Entradas dos últimos 28 dias (inclui a aberta). */
  entries: TimeEntryLite[];
  openTimer: TimeEntryLite | null;
  focusGoalMinutes: number;
}

const TASK_COLS = "id, title, notes, due_on, status, moves_revenue, priority, completed_at, goal_id";

async function supa() {
  return createClient();
}

export async function loadTasks(today: ISODate): Promise<TasksData> {
  const supabase = await supa();
  const { from, to } = dayInstantRange(today);
  const [open, done] = await Promise.all([
    supabase.from("tasks").select(TASK_COLS).eq("status", "todo").order("due_on", { ascending: true, nullsFirst: false }).limit(300),
    supabase
      .from("tasks")
      .select(TASK_COLS)
      .eq("status", "done")
      .gte("completed_at", from.toISOString())
      .lt("completed_at", to.toISOString())
      .order("completed_at", { ascending: false }),
  ]);
  if (open.error) throw new Error(`Falha ao ler tarefas: ${open.error.message}`);
  return { open: (open.data ?? []) as Task[], doneToday: (done.data ?? []) as Task[] };
}

export async function loadHabits(today: ISODate): Promise<HabitsData> {
  const supabase = await supa();
  const since = addDays(startOfWeek(today), -7 * 11);
  const [habits, streaks, logs] = await Promise.all([
    supabase.from("habits").select("id, name, target_per_week, position").eq("active", true).order("position").order("created_at"),
    supabase.from("v_habit_streaks").select("habit_id, unit, current_streak, best_streak"),
    supabase.from("habit_logs").select("habit_id, log_date").gte("log_date", since).lte("log_date", today).limit(5000),
  ]);
  if (habits.error) throw new Error(`Falha ao ler hábitos: ${habits.error.message}`);
  const byHabit = new Map((streaks.data ?? []).map((s) => [s.habit_id as string, s]));
  const grouped: Record<string, ISODate[]> = {};
  for (const l of logs.data ?? []) (grouped[l.habit_id as string] ??= []).push(l.log_date as ISODate);
  return {
    habits: (habits.data ?? []).map((h) => {
      const s = byHabit.get(h.id as string);
      return {
        id: h.id as string,
        name: h.name as string,
        target_per_week: Number(h.target_per_week),
        position: Number(h.position),
        unit: (s?.unit as "day" | "week") ?? (Number(h.target_per_week) >= 7 ? "day" : "week"),
        current_streak: Number(s?.current_streak ?? 0),
        best_streak: Number(s?.best_streak ?? 0),
      };
    }),
    logs: grouped,
  };
}

export async function loadTime(today: ISODate): Promise<TimeData> {
  const supabase = await supa();
  const since = dayInstantRange(addDays(today, -27)).from;
  const [entries, settings] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, label, started_at, ended_at, is_focus")
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false })
      .limit(1000),
    supabase.from("settings").select("daily_focus_minutes_goal").maybeSingle(),
  ]);
  if (entries.error) throw new Error(`Falha ao ler tempo: ${entries.error.message}`);
  const list = (entries.data ?? []) as TimeEntryLite[];
  // Timer aberto há mais de 28 dias não entra na janela: busca à parte.
  let open = list.find((e) => !e.ended_at) ?? null;
  if (!open) {
    const { data } = await supabase.from("time_entries").select("id, label, started_at, ended_at, is_focus").is("ended_at", null).maybeSingle();
    open = (data as TimeEntryLite | null) ?? null;
  }
  return {
    entries: list,
    openTimer: open,
    focusGoalMinutes: Number(settings.data?.daily_focus_minutes_goal ?? 240),
  };
}
