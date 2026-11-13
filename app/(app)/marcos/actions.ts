"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { syncAchievements } from "@/lib/data/milestone";
import { parseISODate, todayISO } from "@/lib/dates";
import { moveInOrder, periodFromChoice } from "@/lib/metrics/milestones";
import { parseBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

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

const FormSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome ao marco.").max(80),
  metric: z.enum(["revenue_month", "revenue_cumulative", "mrr", "net_month"]),
  target: z.string().trim().min(1).max(40),
  month: z.string().max(10).nullable().optional(),
  deadline: isoDate.nullable().optional(),
});

export type MilestoneFormInput = z.input<typeof FormSchema>;

async function authed(): Promise<Supa | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

/** Depois de mexer em marcos: confere conquistas e atualiza todas as telas. */
async function done(supabase: Supa): Promise<ActionResult> {
  await syncAchievements(supabase).catch(() => []);
  revalidatePath("/", "layout");
  return { ok: true };
}

function toColumns(input: MilestoneFormInput): { ok: true; cols: Record<string, unknown> } | { ok: false; error: string } {
  const parsed = FormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;
  const cents = parseBRL(v.target);
  if (cents === null || cents <= 0) return { ok: false, error: "Meta inválida." };
  try {
    const period = periodFromChoice(v.metric, { month: v.month, deadline: v.deadline }, todayISO());
    return { ok: true, cols: { title: v.title, metric: v.metric, target_cents: cents, ...period } };
  } catch {
    return { ok: false, error: "Prazo inválido (tem que ser hoje ou depois)." };
  }
}

/** Ordem atual dos marcos ativos (ids). */
async function activeOrder(supabase: Supa): Promise<string[]> {
  const { data, error } = await supabase
    .from("milestones")
    .select("id")
    .eq("status", "active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}

/** Grava a ordem como posições 0..n-1 (o 0 é o destaque do Comando). */
async function writeOrder(supabase: Supa, ids: string[]): Promise<boolean> {
  const results = await Promise.all(
    ids.map((mid, position) => supabase.from("milestones").update({ position }).eq("id", mid)),
  );
  return results.every((r) => !r.error);
}

export async function createMilestone(input: MilestoneFormInput): Promise<ActionResult> {
  const c = toColumns(input);
  if (!c.ok) return c;
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const order = await activeOrder(supabase);
  const { error } = await supabase.from("milestones").insert({ ...c.cols, status: "active", position: order.length });
  if (error) return { ok: false, error: "Não foi possível criar o marco." };
  return done(supabase);
}

export async function updateMilestone(milestoneId: string, input: MilestoneFormInput): Promise<ActionResult> {
  if (!id.safeParse(milestoneId).success) return { ok: false, error: "Dados inválidos." };
  const c = toColumns(input);
  if (!c.ok) return c;
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("milestones").update(c.cols).eq("id", milestoneId);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  return done(supabase);
}

/** Sobe/desce na fila. Subir até o topo = vira o marco em destaque. */
export async function moveMilestone(milestoneId: string, dir: -1 | 1): Promise<ActionResult> {
  if (!id.safeParse(milestoneId).success || (dir !== -1 && dir !== 1)) return { ok: false, error: "Dados inválidos." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const order = moveInOrder(await activeOrder(supabase), milestoneId, dir);
  if (!(await writeOrder(supabase, order))) return { ok: false, error: "Não foi possível reordenar." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Ativo/batido → arquivado; arquivado/batido → ativo (no fim da fila). */
export async function setMilestoneStatus(milestoneId: string, status: "active" | "archived"): Promise<ActionResult> {
  if (!id.safeParse(milestoneId).success || !["active", "archived"].includes(status)) {
    return { ok: false, error: "Dados inválidos." };
  }
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const patch =
    status === "active"
      ? { status, achieved_at: null, position: (await activeOrder(supabase)).length }
      : { status, achieved_at: null };
  const { error } = await supabase.from("milestones").update(patch).eq("id", milestoneId);
  if (error) return { ok: false, error: "Não foi possível alterar o marco." };
  if (status === "archived") await writeOrder(supabase, await activeOrder(supabase));
  // Reabrir um marco que continua batido faz ele bater de novo na hora — por isso o sync.
  return done(supabase);
}

/** Exclusão definitiva: só para marcos arquivados. */
export async function deleteMilestone(milestoneId: string): Promise<ActionResult> {
  if (!id.safeParse(milestoneId).success) return { ok: false, error: "Dados inválidos." };
  const supabase = await authed();
  if (!supabase) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("milestones").delete().eq("id", milestoneId).eq("status", "archived");
  if (error) return { ok: false, error: "Não foi possível excluir." };
  revalidatePath("/", "layout");
  return { ok: true };
}
