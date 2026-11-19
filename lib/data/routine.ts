import "server-only";
import { addDays, dayInstantRange, startOfWeek, type ISODate } from "@/lib/dates";
import type { TaskLite } from "@/lib/metrics/routine";
import { createClient } from "@/lib/supabase/server";

export type RotinaTab = "tarefas" | "projetos" | "foco" | "tempo" | "habitos";

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

const TASK_COLS = "id, title, notes, due_on, status, moves_revenue, priority, completed_at, goal_id";

async function supa() {
  return createClient();
}

export async function loadTasks(today: ISODate): Promise<TasksData> {
  const supabase = await supa();
  const { from, to } = dayInstantRange(today);
  const [open, done] = await Promise.all([
    supabase.from("tasks").select(TASK_COLS).in("status", ["todo", "doing"]).order("due_on", { ascending: true, nullsFirst: false }).limit(300),
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

