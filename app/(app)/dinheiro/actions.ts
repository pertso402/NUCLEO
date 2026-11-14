"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate, todayISO } from "@/lib/dates";
import { initialLastGenerated } from "@/lib/metrics/recurring";
import { parseBRL } from "@/lib/money";
import { syncAchievements } from "@/lib/data/milestone";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const id = z.uuid();

const UpdateSchema = z.object({
  id,
  kind: z.enum(["income", "expense"]),
  amount: z.string().trim().min(1).max(40),
  occurred_on: z.string().refine((s) => {
    try {
      parseISODate(s);
      return true;
    } catch {
      return false;
    }
  }),
  category_id: id.nullable(),
  description: z.string().trim().max(500),
  counterparty: z.string().trim().max(200),
});

export type UpdateTransactionInput = z.input<typeof UpdateSchema>;

async function authed() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

/** Depois de mexer em lançamentos: confere se algum marco foi batido e atualiza as telas. */
async function done(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ActionResult> {
  await syncAchievements(supabase).catch(() => []); // conquista é bônus: não derruba a edição
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edição inline de um lançamento. Valor chega como texto pt-BR e vira centavos sem float. */
export async function updateTransaction(input: UpdateTransactionInput): Promise<ActionResult> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const v = parsed.data;

  const cents = parseBRL(v.amount);
  if (cents === null || cents <= 0) return { ok: false, error: "Valor inválido." };

  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };

  if (v.category_id) {
    const { data: cat } = await supabase.from("categories").select("kind").eq("id", v.category_id).maybeSingle();
    if (!cat) return { ok: false, error: "Categoria não encontrada." };
    if (cat.kind !== v.kind) return { ok: false, error: "Categoria não combina com o tipo." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      kind: v.kind,
      amount_cents: cents,
      occurred_on: v.occurred_on,
      category_id: v.category_id,
      description: v.description || null,
      counterparty: v.counterparty || null,
    })
    .eq("id", v.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  return done(supabase);
}

/** Confirma um lançamento `pending_review` (passa a contar nos totais e no marco). */
export async function confirmTransaction(txId: string): Promise<ActionResult> {
  if (!id.safeParse(txId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", txId);
  if (error) return { ok: false, error: "Não foi possível confirmar." };
  return done(supabase);
}

export async function deleteTransaction(txId: string): Promise<ActionResult> {
  if (!id.safeParse(txId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("transactions").delete().eq("id", txId);
  if (error) return { ok: false, error: "Não foi possível excluir." };
  return done(supabase);
}

// ------------------------------------------------------------------ recorrentes (2.11)

const RuleSchema = z.object({
  description: z.string().trim().min(1, "Dê um nome (ex.: Aluguel).").max(120),
  amount: z.string().trim().min(1).max(40),
  kind: z.enum(["income", "expense"]),
  category_id: id.nullable(),
  day_of_month: z.number().int().min(1).max(31),
});
export type RecurringRuleInput = z.input<typeof RuleSchema>;

function ruleRow(r: z.output<typeof RuleSchema>) {
  const cents = parseBRL(r.amount);
  if (cents === null || cents <= 0) return null;
  return { description: r.description, amount_cents: cents, kind: r.kind, category_id: r.category_id, day_of_month: r.day_of_month };
}

/** Cria uma regra. Se o dia já passou neste mês, começa no próximo (este mês você já lançou). */
export async function createRecurringRule(input: RecurringRuleInput): Promise<ActionResult> {
  const parsed = RuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const row = ruleRow(parsed.data);
  if (!row) return { ok: false, error: "Valor inválido." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase
    .from("recurring_rules")
    .insert({ ...row, last_generated_on: initialLastGenerated(row.day_of_month, todayISO()) });
  if (error) return { ok: false, error: "Não deu para salvar a recorrência." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateRecurringRule(ruleId: string, input: RecurringRuleInput): Promise<ActionResult> {
  const parsed = RuleSchema.safeParse(input);
  if (!id.safeParse(ruleId).success || !parsed.success) return { ok: false, error: "Dados inválidos." };
  const row = ruleRow(parsed.data);
  if (!row) return { ok: false, error: "Valor inválido." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("recurring_rules").update(row).eq("id", ruleId);
  if (error) return { ok: false, error: "Não deu para salvar a recorrência." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Pausa ou retoma. Ao retomar, não gera vencimentos que passaram enquanto estava pausada. */
export async function setRecurringRuleActive(ruleId: string, active: boolean): Promise<ActionResult> {
  if (!id.safeParse(ruleId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  let patch: Record<string, unknown> = { active };
  if (active) {
    const { data } = await supabase.from("recurring_rules").select("day_of_month, last_generated_on").eq("id", ruleId).maybeSingle();
    const skip = data ? initialLastGenerated(Number(data.day_of_month), todayISO()) : null;
    if (skip && (!data?.last_generated_on || String(data.last_generated_on) < skip)) patch = { active, last_generated_on: skip };
  }
  const { error } = await supabase.from("recurring_rules").update(patch).eq("id", ruleId);
  if (error) return { ok: false, error: "Não deu para mudar a recorrência." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Exclui a regra (os lançamentos já gerados ficam). */
export async function deleteRecurringRule(ruleId: string): Promise<ActionResult> {
  if (!id.safeParse(ruleId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("recurring_rules").delete().eq("id", ruleId);
  if (error) return { ok: false, error: "Não deu para excluir a recorrência." };
  revalidatePath("/", "layout");
  return { ok: true };
}
