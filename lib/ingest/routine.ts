import "server-only";
import { addDays, dayInstantRange, startOfDayInstant, todayISO, weekday, type ISODate } from "@/lib/dates";
import { matchByName } from "./match";
import type { ActionOutcome, ExecContext } from "./executor";
import type { ToolCall } from "./tools";

/**
 * Ferramentas de rotina do parser (Fase 2.2): tarefas, hábitos e tempo.
 * Toda escrita usa o client admin, então SEMPRE grava/filtra com `ctx.userId`.
 * Cada alteração guarda o estado anterior em `updated` para o "desfaz".
 */

type Args<N extends ToolCall["name"]> = Extract<ToolCall, { name: N }>["args"];

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "hoje", "amanhã", "ontem" ou "sex 20/11". */
export function dayLabel(iso: ISODate, today: ISODate): string {
  if (iso === today) return "hoje";
  if (iso === addDays(today, 1)) return "amanhã";
  if (iso === addDays(today, -1)) return "ontem";
  return `${WEEKDAY_SHORT[weekday(iso)]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** 45 → "45 min", 60 → "1h", 85 → "1h25". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

const minutesBetween = (from: string | Date, to: Date) =>
  Math.max(0, Math.round((to.getTime() - new Date(from).getTime()) / 60_000));

/** Data informada pelo modelo, sem aceitar futuro (hábito/tempo de amanhã não existe). */
function pastOrToday(date: string | null, today: ISODate): ISODate {
  return date && date <= today ? date : today;
}

const shortList = (items: string[]) => items.slice(0, 4).map((t) => `"${t}"`).join(", ");

const PRIORITY_OF = { agora: 0, alta: 1, media: 2, baixa: 3 } as const;

/**
 * Departamento citado (Fase P.8): procura no projeto informado; sem projeto, em todos os ativos.
 * Não achou/ambíguo: segue sem departamento e avisa.
 */
export function resolveArea(
  ref: string | null | undefined,
  project: { id: string } | null,
  ctx: ExecContext,
): { area: { id: string; name: string; project_id: string; sequential: boolean } | null; note: string | null } {
  if (!ref?.trim()) return { area: null, note: null };
  // O modelo às vezes devolve "Projeto › Departamento" (formato da lista): usa as duas partes.
  if (ref.includes("›")) {
    const [projRef, ...rest] = ref.split("›");
    const named = project ?? resolveProject(projRef, ctx).project;
    return resolveArea(rest.join("›").trim(), named, ctx);
  }
  const pool = (ctx.routine.areas ?? []).filter((a) => !project || a.project_id === project.id);
  const m = matchByName(pool, ref, (a) => a.name);
  if (m && "item" in m) return { area: m.item, note: null };
  if (m && "ambiguous" in m) return { area: null, note: `departamento "${ref}" existe em mais de um projeto, diga qual` };
  return { area: null, note: `departamento "${ref}" não existe${project ? " nesse projeto" : ""}` };
}

/**
 * Projeto citado pelo Peter (Fase P). Não achou ou ficou ambíguo: segue sem projeto e avisa na resposta
 * (não trava a captura por causa disso).
 */
export function resolveProject(
  ref: string | null | undefined,
  ctx: ExecContext,
): { project: { id: string; name: string } | null; note: string | null } {
  if (!ref?.trim()) return { project: null, note: null };
  const m = matchByName(ctx.routine.projects, ref, (p) => p.name);
  if (m && "item" in m) return { project: m.item, note: null };
  if (m && "ambiguous" in m) return { project: null, note: `projeto "${ref}" ficou ambíguo (${shortList(m.ambiguous.map((p) => p.name))}), salvei sem projeto` };
  return { project: null, note: `projeto "${ref}" não existe, salvei sem projeto` };
}

// ------------------------------------------------------------------ tarefas

export async function addTask(args: Args<"add_task">, ctx: ExecContext): Promise<ActionOutcome> {
  const today = todayISO(ctx.now);
  const dueOn = args.due_on ? (args.due_on < today ? today : args.due_on) : null;
  const goal = args.goal_ref ? matchByName(ctx.routine.goals, args.goal_ref, (g) => g.title) : null;
  const goalId = goal && "item" in goal ? goal.item.id : null;
  const title = args.title.trim();
  let { project, note } = resolveProject(args.project_ref, ctx);
  const area = resolveArea(args.area_ref, project, ctx);
  if (area.area && !project) {
    project = ctx.routine.projects.find((p) => p.id === area.area!.project_id) ?? null;
    note = null;
  }
  const priority = PRIORITY_OF[args.priority];
  let sequence: number | null = null;
  if (area.area) {
    const { data: last } = await ctx.supabase
      .from("tasks")
      .select("sequence")
      .eq("user_id", ctx.userId)
      .eq("area_id", area.area.id)
      .not("sequence", "is", null)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    sequence = last ? Number(last.sequence) + 1 : 0;
  }

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      user_id: ctx.userId,
      title,
      due_on: dueOn,
      moves_revenue: args.moves_revenue,
      goal_id: goalId,
      project_id: project?.id ?? null,
      area_id: area.area?.id ?? null,
      sequence,
      priority,
      source: ctx.source,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar tarefa: ${error.message}`);
  const id = data.id as string;
  ctx.routine.openTasks.push({
    id,
    title,
    due_on: dueOn,
    moves_revenue: args.moves_revenue,
    project_id: project?.id ?? null,
    area_id: area.area?.id ?? null,
    sequence,
  });

  const parts = [`Tarefa: ${title}`];
  if (project) parts.push(area.area ? `${project.name} › ${area.area.name}${area.area.sequential ? ` (etapa ${(sequence ?? 0) + 1})` : ""}` : project.name);
  if (priority === 0) parts.push("🔥 agora");
  else if (priority === 1) parts.push("prioridade alta");
  if (area.note) parts.push(area.note);
  if (dueOn) parts.push(dayLabel(dueOn, today));
  if (args.moves_revenue) parts.push("mexe no faturamento");
  if (note) parts.push(note);
  return { tool: "add_task", ok: true, line: `✅ ${parts.join(" · ")}`, created: [{ table: "tasks", id }] };
}

export async function completeTask(args: Args<"complete_task">, ctx: ExecContext): Promise<ActionOutcome> {
  const open = ctx.routine.openTasks;
  const m = matchByName(open, args.task_ref, (t) => t.title);
  if (!m) {
    const hint = open.length ? ` Abertas: ${shortList(open.map((t) => t.title))}.` : " Não tem tarefa aberta.";
    return { tool: "complete_task", ok: false, clarification: true, line: `❓ Não achei a tarefa "${args.task_ref}".${hint}` };
  }
  if ("ambiguous" in m) {
    return { tool: "complete_task", ok: false, clarification: true, line: `❓ Qual delas? ${shortList(m.ambiguous.map((t) => t.title))}` };
  }

  const task = m.item;
  const { error } = await ctx.supabase
    .from("tasks")
    .update({ status: "done", completed_at: ctx.now.toISOString() })
    .eq("id", task.id)
    .eq("user_id", ctx.userId)
    .in("status", ["todo", "doing"]);
  if (error) throw new Error(`Falha ao concluir tarefa: ${error.message}`);
  ctx.routine.openTasks = open.filter((t) => t.id !== task.id);

  // Em departamento com sequência: diz qual é a próxima etapa.
  let nextLine = "";
  const area = task.area_id ? (ctx.routine.areas ?? []).find((a) => a.id === task.area_id) : null;
  if (area?.sequential) {
    const next = ctx.routine.openTasks
      .filter((t) => t.area_id === area.id)
      .sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER))[0];
    nextLine = next ? `\n➡️ Próxima em ${area.name}: ${next.title}` : `\n🏁 ${area.name}: sequência concluída`;
  }

  return {
    tool: "complete_task",
    ok: true,
    line: `✅ Feita: ${task.title}${task.moves_revenue ? " · mexeu no faturamento" : ""}${nextLine}`,
    updated: [{ table: "tasks", id: task.id, before: { status: "todo", completed_at: null } }],
  };
}

// ------------------------------------------------------------------ hábitos

export async function logHabit(args: Args<"log_habit">, ctx: ExecContext): Promise<ActionOutcome> {
  const habits = ctx.routine.habits;
  if (!habits.length) {
    return { tool: "log_habit", ok: false, clarification: true, line: "❓ Você ainda não tem hábitos cadastrados. Cria no app primeiro." };
  }
  const m = matchByName(habits, args.habit_ref, (h) => h.name);
  if (!m) {
    return {
      tool: "log_habit",
      ok: false,
      clarification: true,
      line: `❓ Não achei o hábito "${args.habit_ref}". Hábitos: ${shortList(habits.map((h) => h.name))}.`,
    };
  }
  if ("ambiguous" in m) {
    return { tool: "log_habit", ok: false, clarification: true, line: `❓ Qual hábito? ${shortList(m.ambiguous.map((h) => h.name))}` };
  }

  const habit = m.item;
  const today = todayISO(ctx.now);
  const date = pastOrToday(args.date, today);
  const when = date === today ? "" : ` ${dayLabel(date, today)}`;

  const { data, error } = await ctx.supabase
    .from("habit_logs")
    .insert({ user_id: ctx.userId, habit_id: habit.id, log_date: date })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { tool: "log_habit", ok: true, line: `✅ ${habit.name}${when || " hoje"} já estava marcado.` };
    throw new Error(`Falha ao marcar hábito: ${error.message}`);
  }

  const { data: streak } = await ctx.supabase
    .from("v_habit_streaks")
    .select("unit, current_streak")
    .eq("habit_id", habit.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const n = Number(streak?.current_streak ?? 0);
  const streakText =
    n >= 2 ? (streak?.unit === "week" ? ` · ${n} semanas seguidas na meta` : ` · ${n} dias seguidos`) : "";

  return {
    tool: "log_habit",
    ok: true,
    line: `✅ Hábito: ${habit.name}${when}${streakText}`,
    created: [{ table: "habit_logs", id: data.id as string }],
  };
}

// ------------------------------------------------------------------ tempo

async function focusMinutesToday(ctx: ExecContext): Promise<number> {
  const { from, to } = dayInstantRange(todayISO(ctx.now));
  const { data } = await ctx.supabase
    .from("time_entries")
    .select("started_at, ended_at")
    .eq("user_id", ctx.userId)
    .eq("is_focus", true)
    .gte("started_at", from.toISOString())
    .lt("started_at", to.toISOString());
  return (data ?? []).reduce(
    (sum: number, e: { started_at: string; ended_at: string | null }) =>
      sum + minutesBetween(e.started_at, e.ended_at ? new Date(e.ended_at) : ctx.now),
    0,
  );
}

/** Fecha o timer aberto (se houver) e devolve a linha + o estado anterior para o desfaz. */
async function closeOpenTimer(ctx: ExecContext): Promise<Pick<ActionOutcome, "line" | "updated"> | null> {
  const t = ctx.routine.openTimer;
  if (!t) return null;
  const planned =
    t.kind === "pomodoro" && t.planned_minutes ? new Date(new Date(t.started_at).getTime() + t.planned_minutes * 60_000) : null;
  const end = planned && planned < ctx.now ? planned : ctx.now;
  const { error } = await ctx.supabase
    .from("time_entries")
    .update({ ended_at: end.toISOString() })
    .eq("id", t.id)
    .eq("user_id", ctx.userId)
    .is("ended_at", null);
  if (error) throw new Error(`Falha ao parar o timer: ${error.message}`);
  ctx.routine.openTimer = null;
  const label = t.label ? `${t.label} · ` : "";
  return {
    line: `✅ ${t.kind === "pomodoro" ? "Pomodoro" : "Timer"} parado: ${label}${formatDuration(minutesBetween(t.started_at, end))}`,
    updated: [{ table: "time_entries", id: t.id, before: { ended_at: null } }],
  };
}

export async function startTimer(args: Args<"start_timer">, ctx: ExecContext): Promise<ActionOutcome> {
  const closed = await closeOpenTimer(ctx);
  let label = args.label?.trim() || null;
  let { project, note } = resolveProject(args.project_ref, ctx);

  // "foca no cardápio" e existe a tarefa aberta "Montar cardápio de bebidas" → o tempo vai pra tarefa (e pro projeto dela).
  let taskId: string | null = null;
  if (label) {
    const m = matchByName(ctx.routine.openTasks, label, (t) => t.title);
    const task = m && "item" in m ? m.item : null;
    if (task && (!project || !task.project_id || task.project_id === project.id)) {
      taskId = task.id;
      label = task.title;
      if (!project && task.project_id) {
        const p = ctx.routine.projects.find((x) => x.id === task.project_id);
        if (p) {
          project = p;
          note = null;
        }
      }
    }
  }

  let planned: number | null = null;
  if (args.pomodoro) {
    const { data: s } = await ctx.supabase.from("settings").select("pomodoro_focus_minutes").eq("user_id", ctx.userId).maybeSingle();
    planned = Number(s?.pomodoro_focus_minutes ?? 25) || 25;
  }

  const startedAt = ctx.now.toISOString();
  const { data, error } = await ctx.supabase
    .from("time_entries")
    .insert({
      user_id: ctx.userId,
      label,
      started_at: startedAt,
      is_focus: true,
      kind: args.pomodoro ? "pomodoro" : "timer",
      planned_minutes: planned,
      project_id: project?.id ?? null,
      task_id: taskId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao iniciar o timer: ${error.message}`);
  const id = data.id as string;
  ctx.routine.openTimer = { id, label, started_at: startedAt, kind: args.pomodoro ? "pomodoro" : "timer", planned_minutes: planned };
  if (taskId) await ctx.supabase.from("tasks").update({ status: "doing" }).eq("id", taskId).eq("user_id", ctx.userId).eq("status", "todo");

  const what = [label, project?.name].filter(Boolean).join(" · ");
  const head = args.pomodoro ? `✅ Pomodoro de ${planned} min` : "✅ Timer iniciado";
  const started = `${head}${what ? `: ${what}` : ""}${note ? ` (${note})` : ""}`;
  return {
    tool: "start_timer",
    ok: true,
    line: closed ? `${closed.line}\n${started}` : started,
    created: [{ table: "time_entries", id }],
    updated: closed?.updated,
  };
}

export async function stopTimer(ctx: ExecContext): Promise<ActionOutcome> {
  const closed = await closeOpenTimer(ctx);
  if (!closed) return { tool: "stop_timer", ok: false, line: "Nenhum timer rodando." };
  const total = await focusMinutesToday(ctx);
  return {
    tool: "stop_timer",
    ok: true,
    line: `${closed.line} · hoje: ${formatDuration(total)} de foco`,
    updated: closed.updated,
  };
}

export async function logTime(args: Args<"log_time">, ctx: ExecContext): Promise<ActionOutcome> {
  const today = todayISO(ctx.now);
  const date = pastOrToday(args.date, today);
  // Hoje: termina agora. Outro dia: termina às 18h daquele dia (só a duração importa).
  const endedAt = date === today ? ctx.now : new Date(startOfDayInstant(date).getTime() + 18 * 3_600_000);
  const startedAt = new Date(endedAt.getTime() - args.minutes * 60_000);
  const label = args.label.trim();
  const { project, note } = resolveProject(args.project_ref, ctx);

  const { data, error } = await ctx.supabase
    .from("time_entries")
    .insert({
      user_id: ctx.userId,
      label,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      is_focus: true,
      kind: "manual",
      project_id: project?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao registrar tempo: ${error.message}`);

  const when = date === today ? "" : ` · ${dayLabel(date, today)}`;
  return {
    tool: "log_time",
    ok: true,
    line: `✅ Tempo: ${formatDuration(args.minutes)} · ${label}${project ? ` · ${project.name}` : ""}${when}${note ? ` (${note})` : ""}`,
    created: [{ table: "time_entries", id: data.id as string }],
  };
}
