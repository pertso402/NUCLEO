"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
import { AREAS, isQuarter, parseDecimal } from "@/lib/metrics/goals";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações da tela Objetivos. Sessão do dono (RLS). Métricas chegam como texto pt-BR
 * ("12,5", "1.200") e viram número aqui — não é dinheiro (dinheiro tem marcos próprios).
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

type Supa = Awaited<ReturnType<typeof createClient>>;

const id = z.uuid();
const isoDate = z.string().refine((s) => {
  try {
    parseISODate(s);
    return true;
  } catch {
    return false;
  }
});

async function authed(): Promise<Supa | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

function finish(error: { message: string } | null, what: string): ActionResult {
  if (error) {
    console.error(`objetivos: ${what}`, error.message);
    return { ok: false, error: `Não deu para ${what}. Tenta de novo.` };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const NOT_AUTHED = { ok: false, error: "Sessão expirada. Entre de novo." } as const satisfies ActionResult;
const INVALID = { ok: false, error: "Dados inválidos." } as const satisfies ActionResult;

const optionalNumber = z
  .string()
  .max(30)
  .transform((s, ctx) => {
    const n = parseDecimal(s);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Use só números (ex.: 12 ou 12,5)." });
      return z.NEVER;
    }
    return n;
  });

const GoalSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um nome ao objetivo.").max(120),
    area: z.enum(AREAS.map((a) => a.value) as [string, ...string[]]),
    why: z.string().trim().max(500),
    quarter: z.string().refine(isQuarter, "Trimestre inválido."),
    target_date: isoDate.nullable(),
    metric_label: z.string().trim().max(60),
    metric_target: optionalNumber,
    metric_current: optionalNumber,
  })
  .refine((g) => g.metric_target === null || g.metric_target > 0, { message: "A meta precisa ser maior que zero." })
  .refine((g) => g.metric_target === null || g.metric_label.length > 0, { message: "Diga o que você está medindo (ex.: clientes)." });

export type GoalInput = z.input<typeof GoalSchema>;

function toRow(g: z.output<typeof GoalSchema>) {
  return {
    title: g.title,
    area: g.area,
    why: g.why || null,
    quarter: g.quarter,
    target_date: g.target_date,
    metric_label: g.metric_label || null,
    metric_target: g.metric_target,
    metric_current: g.metric_target === null ? null : (g.metric_current ?? 0),
  };
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? INVALID.error;

export async function createGoal(input: GoalInput): Promise<ActionResult> {
  const parsed = GoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { count } = await supabase.from("goals").select("id", { count: "exact", head: true }).eq("quarter", parsed.data.quarter);
  const { error } = await supabase.from("goals").insert({ ...toRow(parsed.data), position: count ?? 0 });
  return finish(error, "criar o objetivo");
}

export async function updateGoal(goalId: string, input: GoalInput): Promise<ActionResult> {
  if (!id.safeParse(goalId).success) return INVALID;
  const parsed = GoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("goals").update(toRow(parsed.data)).eq("id", goalId);
  return finish(error, "salvar o objetivo");
}

/** Atualiza só o valor atual da métrica (o "+1" rápido do card). */
export async function setGoalMetric(goalId: string, current: string): Promise<ActionResult> {
  if (!id.safeParse(goalId).success) return INVALID;
  const n = parseDecimal(current);
  if (n === null || Number.isNaN(n) || n < 0) return { ok: false, error: "Valor inválido." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("goals").update({ metric_current: n }).eq("id", goalId);
  return finish(error, "atualizar a métrica");
}

export async function setGoalStatus(goalId: string, status: "active" | "done" | "dropped"): Promise<ActionResult> {
  if (!id.safeParse(goalId).success || !["active", "done", "dropped"].includes(status)) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("goals").update({ status }).eq("id", goalId);
  return finish(error, "mudar o status do objetivo");
}

/** Cria uma tarefa já vinculada ao objetivo. */
export async function addGoalTask(goalId: string, title: string): Promise<ActionResult> {
  const t = z.string().trim().min(1).max(200).safeParse(title);
  if (!id.safeParse(goalId).success || !t.success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("tasks").insert({ title: t.data, goal_id: goalId, source: "app" });
  return finish(error, "criar a tarefa");
}
