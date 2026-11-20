/**
 * Prioridade e sequência de tarefas (Fase P.8), puro e testável.
 * Escala única para projeto, departamento e tarefa: 0 urgente/agora · 1 alta · 2 média · 3 baixa.
 * Departamento "em sequência": as tarefas seguem uma ordem (1, 2, 3…) e só a primeira aberta é a próxima.
 */

export type Priority = 0 | 1 | 2 | 3;

export const PRIORITIES: { value: Priority; label: string; task: string }[] = [
  { value: 0, label: "Urgente", task: "Agora" },
  { value: 1, label: "Alta", task: "Alta" },
  { value: 2, label: "Média", task: "Média" },
  { value: 3, label: "Baixa", task: "Baixa" },
];

export const priorityLabel = (p: number, kind: "task" | "group" = "group"): string => {
  const x = PRIORITIES.find((q) => q.value === p) ?? PRIORITIES[2]!;
  return kind === "task" ? x.task : x.label;
};

export interface SeqTask {
  id: string;
  title: string;
  status: "todo" | "doing" | "done" | "dropped";
  priority: number;
  project_id: string | null;
  area_id: string | null;
  sequence: number | null;
  due_on: string | null;
}

export interface SeqArea {
  id: string;
  project_id: string;
  name: string;
  priority: number;
  sequential: boolean;
  position: number;
}

export interface SeqProject {
  id: string;
  priority: number;
  position: number;
}

const isOpen = (t: Pick<SeqTask, "status">) => t.status === "todo" || t.status === "doing";

/**
 * Ordem das tarefas dentro de um departamento.
 * Em sequência: pela posição (sem posição vai pro fim), empate por prioridade.
 * Sem sequência: "fazendo" primeiro, depois prioridade, depois prazo.
 */
export function orderAreaTasks<T extends SeqTask>(tasks: readonly T[], sequential: boolean): T[] {
  const seq = (t: T) => t.sequence ?? Number.MAX_SAFE_INTEGER;
  return [...tasks].sort((a, b) =>
    sequential
      ? seq(a) - seq(b) || a.priority - b.priority || a.title.localeCompare(b.title, "pt-BR")
      : Number(b.status === "doing") - Number(a.status === "doing") ||
        a.priority - b.priority ||
        (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") ||
        a.title.localeCompare(b.title, "pt-BR"),
  );
}

/** Estado de cada tarefa aberta num departamento: "próxima", "na fila" (sequência) ou "livre". */
export type SeqState = "next" | "queued" | "free";

export function sequenceStates<T extends SeqTask>(tasks: readonly T[], sequential: boolean): Map<string, { state: SeqState; step: number }> {
  const out = new Map<string, { state: SeqState; step: number }>();
  const ordered = orderAreaTasks(tasks.filter(isOpen), sequential);
  ordered.forEach((t, i) => out.set(t.id, { state: !sequential ? "free" : i === 0 ? "next" : "queued", step: i + 1 }));
  return out;
}

/** Nova ordem depois de subir/descer uma tarefa. Devolve os ids na ordem nova. */
export function moveInSequence(ids: readonly string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export interface DoNowItem<T> {
  task: T;
  reason: "agora" | "proxima" | "fazendo";
}

/**
 * "Fazer agora": o que destrava trabalho primeiro.
 * - tarefas marcadas Agora (prioridade 0) e as que já estão "fazendo";
 * - a próxima de cada departamento em sequência;
 * - em departamento sem sequência, as de prioridade alta.
 * Ordem: motivo (agora > fazendo > próxima), prioridade do projeto, do departamento, da tarefa.
 * Projetos pausados/concluídos ficam de fora (passe só os ativos em `projects`).
 */
export function doNow<T extends SeqTask>(
  tasks: readonly T[],
  areas: readonly SeqArea[],
  projects: readonly SeqProject[],
  limit = 8,
): DoNowItem<T>[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const open = tasks.filter(isOpen).filter((t) => !t.project_id || projectById.has(t.project_id));

  const picked = new Map<string, DoNowItem<T>>();
  for (const t of open) {
    if (t.priority === 0) picked.set(t.id, { task: t, reason: "agora" });
    else if (t.status === "doing") picked.set(t.id, { task: t, reason: "fazendo" });
  }
  for (const a of areas) {
    if (!projectById.has(a.project_id)) continue;
    const mine = open.filter((t) => t.area_id === a.id);
    if (a.sequential) {
      const first = orderAreaTasks(mine, true)[0];
      if (first && !picked.has(first.id)) picked.set(first.id, { task: first, reason: "proxima" });
    } else {
      for (const t of mine) if (t.priority <= 1 && !picked.has(t.id)) picked.set(t.id, { task: t, reason: "proxima" });
    }
  }

  const rank = { agora: 0, fazendo: 1, proxima: 2 } as const;
  const pp = (t: T) => (t.project_id ? (projectById.get(t.project_id)?.priority ?? 2) : 2);
  const ap = (t: T) => (t.area_id ? (areaById.get(t.area_id)?.priority ?? 2) : 2);
  return [...picked.values()]
    .sort(
      (x, y) =>
        rank[x.reason] - rank[y.reason] ||
        pp(x.task) - pp(y.task) ||
        ap(x.task) - ap(y.task) ||
        x.task.priority - y.task.priority ||
        (x.task.due_on ?? "9999").localeCompare(y.task.due_on ?? "9999"),
    )
    .slice(0, limit);
}

/** Projetos ordenados por prioridade (e posição). */
export function sortByPriority<T extends { priority: number; position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.priority - b.priority || a.position - b.position);
}
