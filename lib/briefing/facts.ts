import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadHighlightMilestone, type HighlightMilestone } from "@/lib/data/milestone";
import { loadToday } from "@/lib/data/today";
import { addDays, formatLongDate, startOfWeek, todayISO, weekday } from "@/lib/dates";
import { formatBRL, toCents } from "@/lib/money";
import type { BriefingFacts, ClosingFacts, MilestoneFacts } from "./compose";

const brl = (c: number) => formatBRL(c, { cents: false });

export function fmtMinutes(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function dueText(due: string | null, today: string): string {
  if (!due) return "";
  if (due < today) return ` (atrasada desde ${due.slice(8, 10)}/${due.slice(5, 7)})`;
  if (due === today) return " (hoje)";
  if (due === addDays(today, 1)) return " (amanhã)";
  return ` (${WD[weekday(due)]} ${due.slice(8, 10)}/${due.slice(5, 7)})`;
}

export function milestoneFacts(h: HighlightMilestone | null): MilestoneFacts | null {
  if (!h) return null;
  const p = h.pace;
  return {
    title: h.milestone.title,
    current: brl(p.currentCents),
    target: brl(p.targetCents),
    remaining: brl(p.remainingCents),
    pct: Math.floor(p.pct * 100),
    achieved: p.achieved,
    onTrack: p.onTrack,
    // Meta diária em reais inteiros, arredondada pra cima (R$ 909,10 → R$ 910).
    neededPerDay: brl(Math.ceil(p.paceNeededCents / 100) * 100),
    bdLeft: p.bdLeft,
  };
}

type Ctx = { supabase: SupabaseClient; userId: string; now: Date };

/** Fatos do briefing da manhã (client admin + dono). */
export async function loadBriefingFacts({ supabase, userId, now }: Ctx): Promise<BriefingFacts> {
  const today = todayISO(now);
  const weekStart = startOfWeek(today);
  const [highlight, day, due, habits, logs] = await Promise.all([
    loadHighlightMilestone(supabase, { userId, now }),
    loadToday(now, { supabase, userId }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "todo").lte("due_on", today),
    supabase.from("habits").select("id, name, target_per_week").eq("user_id", userId).eq("active", true).order("position"),
    supabase.from("habit_logs").select("habit_id, log_date").eq("user_id", userId).gte("log_date", weekStart).lt("log_date", today),
  ]);
  const weekCount = new Map<string, number>();
  for (const l of logs.data ?? []) weekCount.set(l.habit_id as string, (weekCount.get(l.habit_id as string) ?? 0) + 1);
  const habitNames = (habits.data ?? [])
    .filter((h) => Number(h.target_per_week) >= 7 || (weekCount.get(h.id as string) ?? 0) < Number(h.target_per_week))
    .map((h) => h.name as string);

  return {
    kind: "briefing",
    dateLabel: formatLongDate(today),
    milestone: milestoneFacts(highlight),
    revenueTasks: day.revenueTasks.map((t) => `${t.title}${dueText(t.due_on, today)}`),
    tasksDueCount: due.count ?? 0,
    habits: habitNames,
    focusGoal: day.workday && day.focusGoalMinutes > 0 ? fmtMinutes(day.focusGoalMinutes) : "",
    principle: day.principle?.text ?? null,
  };
}

/** Fatos do fechamento do dia (e o score, para gravar em `daily_reviews`). */
export async function loadClosingFacts({ supabase, userId, now }: Ctx, reviewUrl: string): Promise<ClosingFacts> {
  const today = todayISO(now);
  const tomorrow = addDays(today, 1);
  const [highlight, day, income, tomorrowTasks] = await Promise.all([
    loadHighlightMilestone(supabase, { userId, now }),
    loadToday(now, { supabase, userId }),
    supabase
      .from("transactions")
      .select("amount_cents")
      .eq("user_id", userId)
      .eq("kind", "income")
      .eq("status", "confirmed")
      .eq("occurred_on", today),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "todo").eq("due_on", tomorrow),
  ]);
  const incomeCents = (income.data ?? []).reduce((s, r) => s + toCents(r.amount_cents as number), 0);

  return {
    kind: "closing",
    dateLabel: formatLongDate(today),
    score: day.score.score,
    revenueDone: day.revenueDoneToday,
    revenuePlanned: day.revenuePlanned,
    focus: fmtMinutes(day.focusMinutes),
    focusGoal: day.workday && day.focusGoalMinutes > 0 ? fmtMinutes(day.focusGoalMinutes) : "",
    habitsDone: day.habitsDone,
    habitsExpected: day.habitsExpected,
    incomeToday: incomeCents > 0 ? brl(incomeCents) : null,
    milestone: milestoneFacts(highlight),
    tomorrowCount: tomorrowTasks.count ?? 0,
    reviewUrl,
  };
}
