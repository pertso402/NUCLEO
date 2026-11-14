import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dayInstantRange, type ISODate } from "@/lib/dates";
import { weekNumbers, type WeekNumbers } from "@/lib/metrics/week";
import { createClient } from "@/lib/supabase/server";

export interface DailyReview {
  review_date: ISODate;
  score: number | null;
  win: string | null;
  lesson: string | null;
  energy: number | null;
  tomorrow_top3: string[];
}

export interface WeeklyReview {
  week_start: ISODate;
  wins: string | null;
  misses: string | null;
  focus_next_week: string | null;
}

type Ctx = { supabase: SupabaseClient; userId: string };

/** Sessão do usuário → client + id (para a tela). */
export async function sessionCtx(): Promise<Ctx> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new Error("Sem sessão");
  return { supabase, userId: sub };
}

/** Números de uma semana (seg–dom). Serve para a tela e para o cron (client admin). */
export async function loadWeekNumbers({ supabase, userId }: Ctx, weekStart: ISODate, now: Date): Promise<WeekNumbers> {
  const end = addDays(weekStart, 6);
  const from = dayInstantRange(weekStart).from.toISOString();
  const to = dayInstantRange(end).to.toISOString();
  const [tx, time, tasks, logs, habits, reviews] = await Promise.all([
    supabase
      .from("transactions")
      .select("kind, amount_cents")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("occurred_on", weekStart)
      .lte("occurred_on", end),
    supabase.from("time_entries").select("started_at, ended_at, is_focus").eq("user_id", userId).gte("started_at", from).lt("started_at", to),
    supabase.from("tasks").select("moves_revenue").eq("user_id", userId).eq("status", "done").gte("completed_at", from).lt("completed_at", to),
    supabase.from("habit_logs").select("id").eq("user_id", userId).gte("log_date", weekStart).lte("log_date", end),
    supabase.from("habits").select("target_per_week").eq("user_id", userId).eq("active", true),
    supabase.from("daily_reviews").select("score, win, lesson").eq("user_id", userId).gte("review_date", weekStart).lte("review_date", end),
  ]);
  for (const r of [tx, time, tasks, logs, habits, reviews]) if (r.error) throw new Error(`Falha ao ler a semana: ${r.error.message}`);
  return weekNumbers(
    {
      transactions: (tx.data ?? []) as { kind: "income" | "expense"; amount_cents: number }[],
      timeEntries: (time.data ?? []) as { started_at: string; ended_at: string | null; is_focus: boolean }[],
      tasksDone: (tasks.data ?? []) as { moves_revenue: boolean }[],
      habitLogs: logs.data ?? [],
      habits: (habits.data ?? []) as { target_per_week: number }[],
      reviews: (reviews.data ?? []) as { score: number | null; win: string | null; lesson: string | null }[],
    },
    now,
  );
}

const DAILY_COLS = "review_date, score, win, lesson, energy, tomorrow_top3";

/** Fechamento de hoje (se já existe), o top 3 que você planejou ontem e os scores dos últimos 7 dias. */
export async function loadDailyReviewData(today: ISODate) {
  const { supabase, userId } = await sessionCtx();
  const { data, error } = await supabase
    .from("daily_reviews")
    .select(DAILY_COLS)
    .eq("user_id", userId)
    .gte("review_date", addDays(today, -6))
    .lte("review_date", today)
    .order("review_date");
  if (error) throw new Error(`Falha ao ler revisões: ${error.message}`);
  const rows = (data ?? []) as DailyReview[];
  return {
    todayReview: rows.find((r) => r.review_date === today) ?? null,
    yesterdayTop3: rows.find((r) => r.review_date === addDays(today, -1))?.tomorrow_top3 ?? [],
    last7: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { date: d, score: rows.find((r) => r.review_date === d)?.score ?? null };
    }),
  };
}

/** Revisão semanal salva + números da semana e da anterior. */
export async function loadWeeklyReviewData(weekStart: ISODate, now: Date) {
  const ctx = await sessionCtx();
  const [saved, cur, prev] = await Promise.all([
    ctx.supabase
      .from("weekly_reviews")
      .select("week_start, wins, misses, focus_next_week")
      .eq("user_id", ctx.userId)
      .eq("week_start", weekStart)
      .maybeSingle(),
    loadWeekNumbers(ctx, weekStart, now),
    loadWeekNumbers(ctx, addDays(weekStart, -7), now),
  ]);
  return { review: (saved.data as WeeklyReview | null) ?? null, numbers: cur, previous: prev };
}
