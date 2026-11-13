"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
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
