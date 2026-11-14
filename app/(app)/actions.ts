"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Ações do Comando. Sessão do dono (RLS). */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Cadastra um princípio pessoal (entra na rotação do "Princípio do dia"). */
export async function addPrinciple(text: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(3, "Escreva o princípio.").max(280).safeParse(text);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Texto inválido." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { count } = await supabase.from("principles").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("principles").insert({ text: parsed.data, position: count ?? 0 });
  if (error) {
    console.error("comando: princípio", error.message);
    return { ok: false, error: "Não deu para salvar. Tenta de novo." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
