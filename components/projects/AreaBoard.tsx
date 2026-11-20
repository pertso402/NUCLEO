"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Clock3, Flame, ListOrdered, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useFocusMaybe } from "@/components/focus/FocusProvider";
import { TaskEditor } from "@/components/routine/TaskBoard";
import { Button } from "@/components/ui/Button";
import { PriorityChip, PriorityPicker } from "@/components/ui/Priority";
import { cn } from "@/lib/cn";
import type { Project, ProjectArea, WorkTask } from "@/lib/data/productivity";
import { moveInSequence, orderAreaTasks, sequenceStates, type Priority } from "@/lib/metrics/sequence";
import { fmtHours } from "@/lib/metrics/time";
import { createTask, setTaskDone, type ActionResult } from "@/app/(app)/rotina/actions";
import { createArea, deleteArea, reorderArea, setTaskArea, updateArea } from "@/app/(app)/rotina/productivity-actions";

const field =
  "h-10 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-sm text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

const SUGGESTIONS = ["Marketing", "Comercial", "Operação", "Financeiro", "Produto", "Atendimento"];

type Op = { type: "done"; id: string } | { type: "order"; areaId: string; ids: string[] } | { type: "area"; id: string; areaId: string | null };

/**
 * Departamentos do projeto (Fase P.8): cada um com prioridade e, se quiser, uma sequência de tarefas.
 * Em sequência, a primeira aberta é a "próxima" e as outras ficam "na fila"; ↑↓ reorganiza a ordem.
 */
export function AreaBoard({
  project,
  areas,
  tasks,
  progress,
  allProjects,
}: {
  project: Project;
  areas: ProjectArea[];
  /** Tarefas abertas do projeto. */
  tasks: WorkTask[];
  progress: Record<string, { done: number; total: number }>;
  allProjects: Project[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(areas.length === 0);
  const [, start] = useTransition();

  const [list, apply] = useOptimistic(tasks, (s, op: Op) => {
    if (op.type === "done") return s.filter((t) => t.id !== op.id);
    if (op.type === "area") return s.map((t) => (t.id === op.id ? { ...t, area_id: op.areaId, sequence: 1e9 } : t));
    const pos = new Map(op.ids.map((id, i) => [id, i]));
    return s.map((t) => (t.area_id === op.areaId && pos.has(t.id) ? { ...t, sequence: pos.get(t.id)! } : t));
  });

  const run = (op: Op, action: () => Promise<ActionResult>) => {
    setError(null);
    start(async () => {
      apply(op);
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  };

  const loose = list.filter((t) => !t.area_id || !areas.some((a) => a.id === t.area_id));
  const sorted = [...areas].sort((a, b) => a.priority - b.priority || a.position - b.position);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-instrument">Departamentos · {areas.length}</h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-8 items-center gap-1 rounded-full border border-volt/40 bg-volt/10 px-3 text-xs text-volt transition-transform duration-150 active:scale-95"
          >
            <Plus size={14} strokeWidth={2} /> Departamento
          </button>
        )}
      </div>

      {creating && (
        <section className="glass edge-light rounded-md border border-volt/30 p-3">
          <AreaForm
            projectId={project.id}
            suggestions={SUGGESTIONS.filter((s) => !areas.some((a) => a.name.toLowerCase() === s.toLowerCase()))}
            onDone={() => setCreating(false)}
          />
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      {sorted.map((a) => (
        <AreaCard
          key={a.id}
          area={a}
          project={project}
          allProjects={allProjects}
          areas={areas}
          tasks={list.filter((t) => t.area_id === a.id)}
          progress={progress[a.id] ?? { done: 0, total: 0 }}
          onDone={(t) => run({ type: "done", id: t.id }, () => setTaskDone(t.id, true))}
          onReorder={(ids) => run({ type: "order", areaId: a.id, ids }, () => reorderArea(a.id, ids))}
          onError={setError}
        />
      ))}

      {loose.length > 0 && (
        <section className="rounded-md border border-dashed border-line p-3">
          <h3 className="mb-2 text-sm text-text-1">
            Sem departamento <span className="num text-text-2">{loose.length}</span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {loose.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Concluir: ${t.title}`}
                  onClick={() => run({ type: "done", id: t.id }, () => setTaskDone(t.id, true))}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong transition-[border-color,background-color,transform] duration-150 hover:border-volt hover:bg-volt/10 active:scale-90"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-text-0">{t.title}</span>
                <PriorityChip value={t.priority} kind="task" hideMedium />
                {areas.length > 0 && (
                  <select
                    aria-label={`Mover ${t.title} para um departamento`}
                    value=""
                    onChange={(e) => e.target.value && run({ type: "area", id: t.id, areaId: e.target.value }, () => setTaskArea(t.id, e.target.value))}
                    className="h-8 max-w-32 appearance-none rounded-full border border-line bg-white/[0.04] px-3 text-xs text-text-1 focus:outline-none"
                  >
                    <option value="">Mover para…</option>
                    {sorted.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AreaCard({
  area,
  project,
  allProjects,
  areas,
  tasks,
  progress,
  onDone,
  onReorder,
  onError,
}: {
  area: ProjectArea;
  project: Project;
  allProjects: Project[];
  areas: ProjectArea[];
  tasks: WorkTask[];
  progress: { done: number; total: number };
  onDone: (t: WorkTask) => void;
  onReorder: (ids: string[]) => void;
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const focus = useFocusMaybe();
  const ordered = orderAreaTasks(tasks, area.sequential);
  const states = sequenceStates(tasks, area.sequential);
  const ids = ordered.map((t) => t.id);
  const pct = progress.total ? progress.done / progress.total : 0;
  const next = ordered[0];
  const runningTaskId = focus && (focus.view.mode === "timer" || focus.view.mode === "pomodoro") ? focus.view.entry.task_id : null;
  const estimateLeft = ordered.reduce((s, t) => s + Math.max(0, (t.estimate_minutes ?? 0) - t.trackedMinutes), 0);

  return (
    <section
      className={cn("edge-light overflow-hidden rounded-md border bg-bg-2/80", area.priority === 0 ? "border-ember/40" : "border-line")}
      aria-label={`Departamento ${area.name}`}
    >
      <header className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown size={16} strokeWidth={1.75} className={cn("shrink-0 text-text-2 transition-transform duration-150", !open && "-rotate-90")} aria-hidden />
          <span className="truncate text-base font-semibold text-text-0">{area.name}</span>
          <PriorityChip value={area.priority} />
          {area.sequential && (
            <span className="hidden items-center gap-1 text-xs text-text-2 sm:flex">
              <ListOrdered size={12} strokeWidth={1.5} aria-hidden /> em sequência
            </span>
          )}
        </button>
        <span className="num shrink-0 text-xs text-text-2">
          {progress.done}/{progress.total}
        </span>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          aria-label={`Editar ${area.name}`}
          aria-expanded={editing}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
        >
          <Pencil size={14} strokeWidth={1.5} />
        </button>
      </header>
      <div className="mx-3 mt-2 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full origin-left rounded-full bg-volt transition-transform duration-500" style={{ transform: `scaleX(${pct})` }} />
      </div>
      {open && next && (
        <p className="px-3 pt-2 text-xs text-text-2">
          {area.sequential ? "Próxima: " : "Mais importante: "}
          <span className="text-text-0">{next.title}</span>
          {estimateLeft > 0 && <span className="num"> · faltam ~{fmtHours(estimateLeft)} estimadas</span>}
        </p>
      )}

      {editing && (
        <div className="mx-3 mt-3 rounded-md border border-line p-3">
          <AreaForm projectId={project.id} area={area} onDone={() => setEditing(false)} />
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-1.5 p-3">
          {ordered.length === 0 && <p className="py-2 text-center text-sm text-text-2">Nenhuma tarefa aberta aqui.</p>}
          <ol className="flex flex-col gap-1.5">
            {ordered.map((t, i) => {
              const st = states.get(t.id);
              const isNext = st?.state === "next";
              const queued = st?.state === "queued";
              const running = runningTaskId === t.id;
              if (editingTask === t.id) {
                return (
                  <li key={t.id} className="rounded-md border border-volt/30 bg-bg-1 p-3">
                    <TaskEditor task={t} projects={allProjects} areas={areas} onDone={() => setEditingTask(null)} onError={onError} />
                  </li>
                );
              }
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-[border-color,opacity] duration-150",
                    running ? "border-plasma/60" : isNext ? "border-plasma/40 bg-plasma/[0.06]" : "border-line",
                    queued && "opacity-75",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Concluir: ${t.title}`}
                    onClick={() => onDone(t)}
                    className={cn(
                      "group flex size-7 shrink-0 items-center justify-center rounded-full border text-xs transition-[border-color,background-color,transform] duration-150 hover:border-volt hover:bg-volt/10 active:scale-90",
                      isNext ? "border-plasma/70 text-text-0" : "border-line-strong text-text-2",
                    )}
                  >
                    {area.sequential ? (
                      <>
                        <span className="num group-hover:hidden">{i + 1}</span>
                        <Check size={13} strokeWidth={2.5} className="hidden text-volt group-hover:block" aria-hidden />
                      </>
                    ) : null}
                  </button>
                  <button type="button" onClick={() => setEditingTask(t.id)} className="flex min-w-0 flex-1 flex-col items-start text-left">
                    <span className={cn("text-sm", queued ? "text-text-1" : "text-text-0")}>{t.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-2">
                      {isNext && <span className="text-plasma">{running ? "focando agora" : "próxima"}</span>}
                      {queued && <span>na fila</span>}
                      {t.status === "doing" && !isNext && <span className="text-plasma">fazendo</span>}
                      <PriorityChip value={t.priority} kind="task" hideMedium />
                      {(t.estimate_minutes || t.trackedMinutes > 0) && (
                        <span className="num flex items-center gap-0.5">
                          <Clock3 size={11} strokeWidth={1.5} aria-hidden />
                          {t.trackedMinutes === 0 && t.estimate_minutes
                            ? `~${fmtHours(t.estimate_minutes)}`
                            : `${fmtHours(t.trackedMinutes)}${t.estimate_minutes ? ` / ${fmtHours(t.estimate_minutes)}` : ""}`}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="-mr-1 flex shrink-0 items-center">
                    {area.sequential && (
                      <>
                        <button
                          type="button"
                          aria-label={`Subir ${t.title}`}
                          disabled={i === 0}
                          onClick={() => onReorder(moveInSequence(ids, t.id, -1))}
                          className="flex size-8 items-center justify-center rounded-full text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90 disabled:opacity-20"
                        >
                          <ArrowUp size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Descer ${t.title}`}
                          disabled={i === ordered.length - 1}
                          onClick={() => onReorder(moveInSequence(ids, t.id, 1))}
                          className="flex size-8 items-center justify-center rounded-full text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90 disabled:opacity-20"
                        >
                          <ArrowDown size={15} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                    {focus && !running && !queued && (
                      <button
                        type="button"
                        aria-label={`Focar em ${t.title}`}
                        onClick={() => focus.start({ kind: "pomodoro", task_id: t.id, project_id: t.project_id, label: t.title })}
                        className="flex size-8 items-center justify-center rounded-full text-plasma transition-[background-color,transform] duration-150 hover:bg-plasma/15 active:scale-90"
                      >
                        <Play size={14} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <AddStep projectId={project.id} areaId={area.id} sequential={area.sequential} onError={onError} />
        </div>
      )}
    </section>
  );
}

function AddStep({ projectId, areaId, sequential, onError }: { projectId: string; areaId: string; sequential: boolean; onError: (e: string | null) => void }) {
  const [title, setTitle] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onError(null);
    start(async () => {
      const r = await createTask({ title, due_on: null, moves_revenue: false, project_id: projectId, area_id: areaId, priority: urgent ? 0 : 2 });
      if (r.ok) {
        setTitle("");
        setUrgent(false);
      } else onError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="mt-1 flex gap-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={sequential ? "Adicionar próxima etapa…" : "Adicionar tarefa…"}
        aria-label="Nova tarefa no departamento"
        maxLength={200}
        className={field}
      />
      <button
        type="button"
        aria-pressed={urgent}
        aria-label="Marcar como Agora"
        onClick={() => setUrgent(!urgent)}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-sm border transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
          urgent ? "border-ember/60 bg-ember/15 text-ember" : "border-line text-text-2",
        )}
      >
        <Flame size={15} strokeWidth={1.75} />
      </button>
      <Button type="submit" disabled={pending || !title.trim()} aria-label="Adicionar" className="h-10 w-10 shrink-0 px-0">
        <Plus size={18} strokeWidth={2} />
      </Button>
    </form>
  );
}

function AreaForm({
  projectId,
  area,
  suggestions = [],
  onDone,
}: {
  projectId: string;
  area?: ProjectArea;
  suggestions?: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(area?.name ?? "");
  const [priority, setPriority] = useState<Priority>((area?.priority ?? 2) as Priority);
  const [sequential, setSequential] = useState(area?.sequential ?? true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    start(async () => {
      const input = { name, priority, sequential };
      const r = area ? await updateArea(area.id, input) : await createArea(projectId, input);
      if (r.ok) {
        if (area) onDone();
        else setName("");
      } else setError(r.error);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do departamento (ex.: Marketing)"
        aria-label="Nome do departamento"
        maxLength={60}
        className={field}
        autoFocus={!area}
      />
      {!area && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setName(s)}
              className="h-7 rounded-full border border-line px-2.5 text-xs text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <PriorityPicker value={priority} onChange={setPriority} />
      <label className="flex items-center gap-2 text-sm text-text-1">
        <input type="checkbox" checked={sequential} onChange={(e) => setSequential(e.target.checked)} className="size-4 accent-[var(--volt)]" />
        Tarefas em sequência (uma depois da outra)
      </label>
      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {area ? "Salvar" : "Criar departamento"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          {area ? "Cancelar" : "Fechar"}
        </Button>
        {area && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (confirmDelete ? start(async () => void ((await deleteArea(area.id)).ok && onDone())) : setConfirmDelete(true))}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-text-2 transition-[color,transform] duration-150 hover:text-flare active:scale-95"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            {confirmDelete ? "Confirmar (tarefas ficam no projeto)" : "Apagar"}
          </button>
        )}
      </div>
    </form>
  );
}
