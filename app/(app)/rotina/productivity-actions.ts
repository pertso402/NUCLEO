"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate, startOfDayInstant, todayISO } from "@/lib/dates";
import { PROJECT_COLOR_KEYS } from "@/lib/projects-palette";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./actions";

/**
 * Ações da Fase P (produtividade): projetos, foco (timer livre e pomodoro), status "fazendo"
 * e configurações do pomodoro. Sessão do usuário (RLS); o banco checa que projeto/tarefa são do dono.
 */

type Supa = Awaited<ReturnType<typeof createClient>>;

const uuid = z.uuid();
const isoDate = z.string().refine((s) => {
  try {
    parseISODate(s);
    return true;
  } catch {
    return false;
  }
}, "data inválida");

const NOT_AUTHED: ActionResult = { ok: false, error: "Sessão expirada. Entre de novo." };
const INVALID: ActionResult = { ok: false, error: "Dados inválidos." };

async function authed(): Promise<{ supabase: Supa; userId: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, userId: data.user.id } : null;
}

function finish(error: { message: string } | null, what: string): ActionResult {
  if (error) {
    console.error(`produtividade: ${what}`, error.message);
    return { ok: false, error: `Não deu para ${what}. Tenta de novo.` };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos.";

// ------------------------------------------------------------------ projetos

const ProjectSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao projeto.").max(60, "Nome longo demais (máx. 60)."),
  kind: z.enum(["negocio", "cliente", "projeto", "pessoal", "estudo"]),
  color: z.enum(PROJECT_COLOR_KEYS as [string, ...string[]]),
  description: z.string().trim().max(280).nullable().optional(),
  weekly_hours_goal: z.number().positive("Meta de horas precisa ser maior que zero.").max(168).nullable().optional(),
  deadline: isoDate.nullable().optional(),
  lead_id: uuid.nullable().optional(),
  goal_id: uuid.nullable().optional(),
});
export type ProjectInput = z.input<typeof ProjectSchema>;

export async function createProject(input: ProjectInput): Promise<ActionResult & { id?: string }> {
  const parsed = ProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { count } = await a.supabase.from("projects").select("id", { count: "exact", head: true });
  const { data, error } = await a.supabase
    .from("projects")
    .insert({ ...parsed.data, description: parsed.data.description || null, position: count ?? 0 })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Já existe um projeto com esse nome." };
  const r = finish(error, "criar o projeto");
  return r.ok ? { ok: true, id: data?.id as string } : r;
}

export async function updateProject(projectId: string, input: ProjectInput): Promise<ActionResult> {
  const parsed = ProjectSchema.safeParse(input);
  if (!uuid.safeParse(projectId).success) return INVALID;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await a.supabase
    .from("projects")
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq("id", projectId);
  if (error?.code === "23505") return { ok: false, error: "Já existe um projeto com esse nome." };
  return finish(error, "salvar o projeto");
}

/** Ativo · pausado · concluído · arquivado (arquivado some das listas; histórico de tempo fica). */
export async function setProjectStatus(projectId: string, status: "active" | "paused" | "done" | "archived"): Promise<ActionResult> {
  if (!uuid.safeParse(projectId).success || !["active", "paused", "done", "archived"].includes(status)) return INVALID;
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await a.supabase.from("projects").update({ status }).eq("id", projectId);
  return finish(error, "mudar o status do projeto");
}

/** Move uma tarefa para outro projeto (ou tira de qualquer projeto). */
export async function setTaskProject(taskId: string, projectId: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success || (projectId !== null && !uuid.safeParse(projectId).success)) return INVALID;
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await a.supabase.from("tasks").update({ project_id: projectId }).eq("id", taskId);
  return finish(error, "mudar o projeto da tarefa");
}

/** A fazer ⇄ fazendo. */
export async function setTaskDoing(taskId: string, doing: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(taskId).success) return INVALID;
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await a.supabase
    .from("tasks")
    .update({ status: doing ? "doing" : "todo" })
    .eq("id", taskId)
    .in("status", ["todo", "doing"]);
  return finish(error, "atualizar a tarefa");
}

// ------------------------------------------------------------------ foco

const FocusSchema = z.object({
  kind: z.enum(["timer", "pomodoro"]),
  task_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
  planned_minutes: z.number().int().min(1).max(240).nullable().optional(),
});
export type FocusInput = z.input<typeof FocusSchema>;

/**
 * Fecha qualquer sessão aberta. Pomodoro que passou do planejado (app fechado, aparelho dormindo)
 * fecha no tempo planejado — não conta minuto que não foi trabalhado.
 */
async function closeOpen(supabase: Supa, now = new Date()) {
  const { data: open } = await supabase.from("time_entries").select("id, started_at, kind, planned_minutes").is("ended_at", null);
  for (const e of open ?? []) {
    const planned = e.kind === "pomodoro" && e.planned_minutes ? new Date(new Date(e.started_at as string).getTime() + Number(e.planned_minutes) * 60_000) : null;
    const end = planned && planned < now ? planned : now;
    const { error } = await supabase.from("time_entries").update({ ended_at: end.toISOString() }).eq("id", e.id);
    if (error) return { error };
  }
  return { error: null };
}

/** Começa foco (timer livre ou pomodoro), opcionalmente numa tarefa (herda o projeto dela e vira "fazendo"). */
export async function startFocus(input: FocusInput): Promise<ActionResult> {
  const parsed = FocusSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { supabase } = a;
  const task_id = parsed.data.task_id ?? null;
  let project_id = parsed.data.project_id ?? null;
  let label = parsed.data.label ?? null;
  if (task_id) {
    const { data: task } = await supabase.from("tasks").select("id, title, project_id, status").eq("id", task_id).maybeSingle();
    if (!task) return { ok: false, error: "Tarefa não encontrada." };
    project_id = project_id ?? (task.project_id as string | null);
    label = label || (task.title as string);
    if (task.status === "todo") await supabase.from("tasks").update({ status: "doing" }).eq("id", task_id);
  }
  const closed = await closeOpen(supabase);
  if (closed.error) return finish(closed.error, "parar o foco anterior");
  const { error } = await supabase.from("time_entries").insert({
    is_focus: true,
    kind: parsed.data.kind,
    task_id,
    project_id,
    label: label || null,
    planned_minutes: parsed.data.kind === "pomodoro" ? (parsed.data.planned_minutes ?? 25) : null,
  });
  return finish(error, "começar o foco");
}

/** Para o foco aberto (registra o que foi feito até agora). */
export async function stopFocus(): Promise<ActionResult> {
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await closeOpen(a.supabase);
  return finish(error, "parar o foco");
}

/** Pomodoro chegou ao fim: fecha exatamente no tempo planejado. Idempotente. */
export async function finishPomodoro(entryId: string): Promise<ActionResult> {
  if (!uuid.safeParse(entryId).success) return INVALID;
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { data: e } = await a.supabase.from("time_entries").select("id, started_at, ended_at, planned_minutes").eq("id", entryId).maybeSingle();
  if (!e) return INVALID;
  if (e.ended_at) return { ok: true };
  const planned = new Date(new Date(e.started_at as string).getTime() + Number(e.planned_minutes ?? 25) * 60_000);
  const end = planned < new Date() ? planned : new Date();
  const { error } = await a.supabase.from("time_entries").update({ ended_at: end.toISOString() }).eq("id", entryId).is("ended_at", null);
  return finish(error, "fechar o pomodoro");
}

/** Lança tempo já feito, com projeto/tarefa. */
export async function logTime(input: {
  minutes: number;
  date: string;
  label?: string | null;
  project_id?: string | null;
  task_id?: string | null;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      minutes: z.number().int().min(1).max(1440),
      date: isoDate,
      label: z.string().trim().max(120).nullable().optional(),
      project_id: uuid.nullable().optional(),
      task_id: uuid.nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informe a duração em minutos (1 a 1440)." };
  const today = todayISO();
  if (parsed.data.date > today) return { ok: false, error: "Não dá pra lançar tempo no futuro." };
  const a = await authed();
  if (!a) return NOT_AUTHED;
  let projectId = parsed.data.project_id ?? null;
  if (parsed.data.task_id && !projectId) {
    const { data: t } = await a.supabase.from("tasks").select("project_id").eq("id", parsed.data.task_id).maybeSingle();
    projectId = (t?.project_id as string | null) ?? null;
  }
  // Hoje: termina agora. Outro dia: termina às 18h (SP) daquele dia.
  const end = parsed.data.date === today ? new Date() : new Date(startOfDayInstant(parsed.data.date).getTime() + 18 * 3_600_000);
  const start = new Date(end.getTime() - parsed.data.minutes * 60_000);
  const { error } = await a.supabase.from("time_entries").insert({
    label: parsed.data.label || null,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    is_focus: true,
    kind: "manual",
    project_id: projectId,
    task_id: parsed.data.task_id ?? null,
  });
  return finish(error, "lançar o tempo");
}

/** Corrige projeto de um registro de tempo. */
export async function setEntryProject(entryId: string, projectId: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(entryId).success || (projectId !== null && !uuid.safeParse(projectId).success)) return INVALID;
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await a.supabase.from("time_entries").update({ project_id: projectId }).eq("id", entryId);
  return finish(error, "mudar o projeto do registro");
}

// ------------------------------------------------------------------ pomodoro

export async function savePomodoroSettings(input: {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cycles: number;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      focusMinutes: z.number().int().min(5).max(120),
      shortBreakMinutes: z.number().int().min(1).max(60),
      longBreakMinutes: z.number().int().min(1).max(90),
      cycles: z.number().int().min(2).max(10),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Foco 5–120 min, pausas 1–60/1–90 min, ciclos 2–10." };
  const a = await authed();
  if (!a) return NOT_AUTHED;
  const { error } = await a.supabase
    .from("settings")
    .update({
      pomodoro_focus_minutes: parsed.data.focusMinutes,
      pomodoro_short_break_minutes: parsed.data.shortBreakMinutes,
      pomodoro_long_break_minutes: parsed.data.longBreakMinutes,
      pomodoro_cycles: parsed.data.cycles,
    })
    .eq("user_id", a.userId);
  return finish(error, "salvar o pomodoro");
}
