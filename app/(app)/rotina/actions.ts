"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate, startOfDayInstant, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações da tela Rotina. Usam a sessão (RLS): `user_id` vem do default `auth.uid()`.
 * Cada uma valida com Zod e devolve `{ ok }` ou `{ ok: false, error }` em PT-BR.
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
}, "data inválida");

async function authed(): Promise<Supa | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

function finish(error: { message: string } | null, what: string): ActionResult {
  if (error) {
    console.error(`rotina: ${what}`, error.message);
    return { ok: false, error: `Não deu para ${what}. Tenta de novo.` };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const NOT_AUTHED: ActionResult = { ok: false, error: "Sessão expirada. Entre de novo." };
const INVALID = { ok: false, error: "Dados inválidos." } as const satisfies ActionResult;

// ------------------------------------------------------------------ tarefas

const TaskSchema = z.object({
  title: z.string().trim().min(1, "Escreva a tarefa.").max(200),
  due_on: isoDate.nullable(),
  moves_revenue: z.boolean(),
  priority: z.number().int().min(1).max(3).default(2),
});
export type TaskInput = z.input<typeof TaskSchema>;

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const parsed = TaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID.error };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("tasks").insert({ ...parsed.data, source: "app" });
  return finish(error, "criar a tarefa");
}

export async function updateTask(taskId: string, input: TaskInput): Promise<ActionResult> {
  const parsed = TaskSchema.safeParse(input);
  if (!id.safeParse(taskId).success || !parsed.success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", taskId);
  return finish(error, "salvar a tarefa");
}

/** Marca/desmarca como feita. */
export async function setTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  if (!id.safeParse(taskId).success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const patch = done ? { status: "done", completed_at: new Date().toISOString() } : { status: "todo", completed_at: null };
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
  return finish(error, done ? "concluir a tarefa" : "reabrir a tarefa");
}

/** Some da lista sem apagar (desistiu). */
export async function dropTask(taskId: string): Promise<ActionResult> {
  if (!id.safeParse(taskId).success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("tasks").update({ status: "dropped", completed_at: null }).eq("id", taskId);
  return finish(error, "descartar a tarefa");
}

// ------------------------------------------------------------------ hábitos

const HabitSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao hábito.").max(60),
  target_per_week: z.number().int().min(1).max(7),
});
export type HabitInput = z.input<typeof HabitSchema>;

export async function createHabit(input: HabitInput): Promise<ActionResult> {
  const parsed = HabitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID.error };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { count } = await supabase.from("habits").select("id", { count: "exact", head: true }).eq("active", true);
  const { error } = await supabase.from("habits").insert({ ...parsed.data, position: count ?? 0 });
  return finish(error, "criar o hábito");
}

export async function updateHabit(habitId: string, input: HabitInput): Promise<ActionResult> {
  const parsed = HabitSchema.safeParse(input);
  if (!id.safeParse(habitId).success || !parsed.success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("habits").update(parsed.data).eq("id", habitId);
  return finish(error, "salvar o hábito");
}

/** Arquiva (some da lista e do parser; o histórico fica). */
export async function archiveHabit(habitId: string): Promise<ActionResult> {
  if (!id.safeParse(habitId).success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("habits").update({ active: false }).eq("id", habitId);
  return finish(error, "arquivar o hábito");
}

/** Marca ou desmarca um dia (até hoje). */
export async function setHabitDay(habitId: string, date: string, done: boolean): Promise<ActionResult> {
  if (!id.safeParse(habitId).success || !isoDate.safeParse(date).success) return INVALID;
  if (date > todayISO()) return { ok: false, error: "Não dá pra marcar um dia que ainda não chegou." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  if (done) {
    const { error } = await supabase.from("habit_logs").insert({ habit_id: habitId, log_date: date });
    return finish(error?.code === "23505" ? null : error, "marcar o hábito");
  }
  const { error } = await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", date);
  return finish(error, "desmarcar o hábito");
}

// ------------------------------------------------------------------ tempo

async function closeOpen(supabase: Supa) {
  return supabase.from("time_entries").update({ ended_at: new Date().toISOString() }).is("ended_at", null);
}

/** Inicia o timer (fecha o que estiver aberto). */
export async function startTimer(label: string): Promise<ActionResult> {
  const clean = z.string().trim().max(120).safeParse(label);
  if (!clean.success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const closed = await closeOpen(supabase);
  if (closed.error) return finish(closed.error, "parar o timer anterior");
  const { error } = await supabase.from("time_entries").insert({ label: clean.data || null, is_focus: true });
  return finish(error, "iniciar o timer");
}

export async function stopTimer(): Promise<ActionResult> {
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await closeOpen(supabase);
  return finish(error, "parar o timer");
}

/** Lança tempo já feito (sem timer). */
export async function addTimeEntry(input: { label: string; minutes: number; date: string }): Promise<ActionResult> {
  const parsed = z
    .object({ label: z.string().trim().max(120), minutes: z.number().int().min(1).max(1440), date: isoDate })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informe a duração em minutos (1 a 1440)." };
  const today = todayISO();
  if (parsed.data.date > today) return { ok: false, error: "Não dá pra lançar tempo no futuro." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  // Hoje: termina agora. Outro dia: termina às 18h (SP) daquele dia.
  const end =
    parsed.data.date === today ? new Date() : new Date(startOfDayInstant(parsed.data.date).getTime() + 18 * 3_600_000);
  const start = new Date(end.getTime() - parsed.data.minutes * 60_000);
  const { error } = await supabase.from("time_entries").insert({
    label: parsed.data.label || null,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    is_focus: true,
  });
  return finish(error, "lançar o tempo");
}

export async function deleteTimeEntry(entryId: string): Promise<ActionResult> {
  if (!id.safeParse(entryId).success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  return finish(error, "apagar o registro");
}
