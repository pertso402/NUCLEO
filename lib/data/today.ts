import "server-only";
import { dayInstantRange, startOfWeek, todayISO, weekday, type ISODate } from "@/lib/dates";
import { entryMinutes } from "@/lib/metrics/routine";
import { computeScore, habitsForToday, principleOfDay, type DayScore } from "@/lib/metrics/score";
import { createClient } from "@/lib/supabase/server";

export interface RevenueTask {
  id: string;
  title: string;
  due_on: string | null;
}

export interface TodayData {
  today: ISODate;
  workday: boolean;
  score: DayScore;
  focusMinutes: number;
  focusGoalMinutes: number;
  habitsExpected: number;
  habitsDone: number;
  /** Até 3 tarefas abertas que mexem faturamento (atrasadas/hoje primeiro). */
  revenueTasks: RevenueTask[];
  revenueDoneToday: number;
  principle: { id: string; text: string } | null;
}

/** Tudo da faixa "Hoje" do Comando, com o score calculado na hora (ARCHITECTURE §6.2). */
export async function loadToday(now: Date = new Date()): Promise<TodayData> {
  const supabase = await createClient();
  const today = todayISO(now);
  const { from, to } = dayInstantRange(today);
  const weekStart = startOfWeek(today);

  const [settings, openRevenue, doneRevenue, entries, habits, logs, principles] = await Promise.all([
    supabase.from("settings").select("workdays, daily_focus_minutes_goal").maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, due_on")
      .eq("status", "todo")
      .eq("moves_revenue", true)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("priority")
      .limit(50),
    supabase
      .from("tasks")
      .select("id, due_on")
      .eq("status", "done")
      .eq("moves_revenue", true)
      .gte("completed_at", from.toISOString())
      .lt("completed_at", to.toISOString()),
    supabase
      .from("time_entries")
      .select("started_at, ended_at, is_focus")
      .eq("is_focus", true)
      .gte("started_at", from.toISOString())
      .lt("started_at", to.toISOString()),
    supabase.from("habits").select("id, target_per_week").eq("active", true),
    supabase.from("habit_logs").select("habit_id, log_date").gte("log_date", weekStart).lte("log_date", today),
    supabase.from("principles").select("id, text").eq("active", true).order("position").order("created_at"),
  ]);

  const workdays = (settings.data?.workdays as number[] | undefined) ?? [1, 2, 3, 4, 5];
  const workday = workdays.includes(weekday(today));
  const focusGoalMinutes = Number(settings.data?.daily_focus_minutes_goal ?? 240);

  const open = (openRevenue.data ?? []) as RevenueTask[];
  const done = doneRevenue.data ?? [];
  const plannedOpen = open.filter((t) => t.due_on && t.due_on <= today).length;
  const plannedDone = done.filter((t) => t.due_on && t.due_on <= today).length;

  const focusMinutes = (entries.data ?? []).reduce(
    (s, e) => s + entryMinutes(e as { started_at: string; ended_at: string | null }, now),
    0,
  );

  const doneToday = new Set<string>();
  const weekCount = new Map<string, number>();
  for (const l of logs.data ?? []) {
    if (l.log_date === today) doneToday.add(l.habit_id as string);
    else weekCount.set(l.habit_id as string, (weekCount.get(l.habit_id as string) ?? 0) + 1);
  }
  const hab = habitsForToday(
    (habits.data ?? []).map((h) => ({ id: h.id as string, target_per_week: Number(h.target_per_week) })),
    weekCount,
    doneToday,
  );

  const score = computeScore({
    workday,
    revenueTasksPlanned: plannedOpen + plannedDone,
    revenueTasksDone: done.length,
    outreachDone: null, // Pipeline (Fase 3)
    outreachGoal: null,
    focusMinutes,
    focusGoalMinutes,
    habitsExpected: hab.expected,
    habitsDone: hab.done,
  });

  return {
    today,
    workday,
    score,
    focusMinutes,
    focusGoalMinutes,
    habitsExpected: hab.expected,
    habitsDone: hab.done,
    revenueTasks: open.slice(0, 3),
    revenueDoneToday: done.length,
    principle: principleOfDay((principles.data ?? []) as { id: string; text: string }[], today),
  };
}
