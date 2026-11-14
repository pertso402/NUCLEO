"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadToday } from "@/lib/data/today";
import { loadWeekNumbers, sessionCtx } from "@/lib/data/review";
import { addDays, todayISO } from "@/lib/dates";
import { isMonday } from "@/lib/metrics/week";

export type ActionResult = { ok: true; created?: number } | { ok: false; error: string };

const text = (max: number) => z.string().trim().max(max);

const DailySchema = z.object({
  win: text(500),
  lesson: text(500),
  energy: z.number().int().min(1).max(5).nullable(),
  top3: z.array(text(200)).max(3),
  /** Cria as do top 3 como tarefas com prazo amanhã (sem duplicar as que já existem). */
  createTasks: z.boolean(),
});
export type DailyReviewInput = z.input<typeof DailySchema>;

/** Fechamento do dia em 60s: grava a revisão de hoje com o score calculado agora. */
export async function saveDailyReview(input: DailyReviewInput): Promise<ActionResult> {
  const parsed = DailySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos (textos até 500 caracteres)." };
  let ctx;
  try {
    ctx = await sessionCtx();
  } catch {
    return { ok: false, error: "Sessão expirada. Entre de novo." };
  }
  const { supabase, userId } = ctx;
  const now = new Date();
  const today = todayISO(now);
  const top3 = parsed.data.top3.filter(Boolean);
  const day = await loadToday(now, { supabase, userId });

  const { error } = await supabase.from("daily_reviews").upsert(
    {
      user_id: userId,
      review_date: today,
      score: day.score.score,
      win: parsed.data.win || null,
      lesson: parsed.data.lesson || null,
      energy: parsed.data.energy,
      tomorrow_top3: top3,
    },
    { onConflict: "user_id,review_date" },
  );
  if (error) {
    console.error("revisão do dia", error.message);
    return { ok: false, error: "Não deu para salvar. Tenta de novo." };
  }

  let created = 0;
  if (parsed.data.createTasks && top3.length) {
    const tomorrow = addDays(today, 1);
    const { data: existing } = await supabase
      .from("tasks")
      .select("title")
      .eq("user_id", userId)
      .eq("status", "todo")
      .eq("due_on", tomorrow);
    const have = new Set((existing ?? []).map((t) => String(t.title).trim().toLowerCase()));
    const fresh = top3.filter((t) => !have.has(t.toLowerCase()));
    if (fresh.length) {
      const { error: tErr } = await supabase
        .from("tasks")
        .insert(fresh.map((title, i) => ({ title, due_on: tomorrow, priority: i + 1, source: "app" })));
      if (tErr) console.error("revisão: tarefas de amanhã", tErr.message);
      else created = fresh.length;
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, created };
}

const WeeklySchema = z.object({
  weekStart: z.string().refine(isMonday, "Semana inválida."),
  wins: text(2000),
  misses: text(2000),
  focus: text(1000),
});
export type WeeklyReviewInput = z.input<typeof WeeklySchema>;

/** Revisão semanal: grava o texto e uma foto dos números da semana (para comparar depois). */
export async function saveWeeklyReview(input: WeeklyReviewInput): Promise<ActionResult> {
  const parsed = WeeklySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  let ctx;
  try {
    ctx = await sessionCtx();
  } catch {
    return { ok: false, error: "Sessão expirada. Entre de novo." };
  }
  const numbers = await loadWeekNumbers(ctx, parsed.data.weekStart, new Date());
  const { error } = await ctx.supabase.from("weekly_reviews").upsert(
    {
      user_id: ctx.userId,
      week_start: parsed.data.weekStart,
      wins: parsed.data.wins || null,
      misses: parsed.data.misses || null,
      focus_next_week: parsed.data.focus || null,
      numbers,
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) {
    console.error("revisão semanal", error.message);
    return { ok: false, error: "Não deu para salvar. Tenta de novo." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
