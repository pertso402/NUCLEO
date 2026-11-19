"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Check, CircleDollarSign, Clock3, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useFocusMaybe } from "@/components/focus/FocusProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import type { Project, WorkTask } from "@/lib/data/productivity";
import { bucketTasks, isOverdue, type TaskBucket } from "@/lib/metrics/routine";
import { fmtHours } from "@/lib/metrics/time";
import { projectHex } from "@/lib/projects-palette";
import { createTask, dropTask, setTaskDone, updateTask, type ActionResult } from "@/app/(app)/rotina/actions";
import { setTaskDoing } from "@/app/(app)/rotina/productivity-actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

const BUCKETS: { value: TaskBucket; label: string; empty: string }[] = [
  { value: "hoje", label: "Hoje", empty: "Nada pra hoje. Puxa algo da semana ou do backlog." },
  { value: "semana", label: "Semana", empty: "Nada nos próximos 7 dias." },
  { value: "backlog", label: "Backlog", empty: "Backlog vazio." },
];

const ESTIMATES = [15, 30, 60, 120, 240];

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function dueLabel(due: string, today: string): string {
  if (due === today) return "hoje";
  if (due === addDays(today, 1)) return "amanhã";
  if (due === addDays(today, -1)) return "ontem";
  const d = new Date(`${due}T12:00:00Z`);
  return `${WD[d.getUTCDay()]} ${due.slice(8, 10)}/${due.slice(5, 7)}`;
}

type Optimistic =
  | { type: "done"; id: string }
  | { type: "undone"; task: WorkTask }
  | { type: "drop"; id: string }
  | { type: "doing"; id: string; doing: boolean };

/** Filtro: "all" (todos), "none" (sem projeto) ou id do projeto. */
type Filter = "all" | "none" | string;

export function TaskBoard({
  open,
  doneToday,
  today,
  projects,
  projectId,
}: {
  open: WorkTask[];
  doneToday: WorkTask[];
  today: string;
  projects: Project[];
  /** Fixa num projeto (tela do projeto): sem chips de filtro e nova tarefa já nasce nele. */
  projectId?: string;
}) {
  const [bucket, setBucket] = useState<TaskBucket>("hoje");
  const [filter, setFilter] = useState<Filter>(projectId ?? "all");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const focus = useFocusMaybe();

  const [state, apply] = useOptimistic({ open, doneToday }, (s, a: Optimistic) => {
    if (a.type === "done") {
      const t = s.open.find((x) => x.id === a.id);
      return t ? { open: s.open.filter((x) => x.id !== a.id), doneToday: [{ ...t, status: "done" as const }, ...s.doneToday] } : s;
    }
    if (a.type === "undone") {
      return { open: [...s.open, { ...a.task, status: "todo" as const }], doneToday: s.doneToday.filter((x) => x.id !== a.task.id) };
    }
    if (a.type === "doing") {
      return { ...s, open: s.open.map((x) => (x.id === a.id ? { ...x, status: a.doing ? ("doing" as const) : ("todo" as const) } : x)) };
    }
    return { ...s, open: s.open.filter((x) => x.id !== a.id) };
  });

  const run = (optimistic: Optimistic, action: () => Promise<ActionResult>) => {
    setError(null);
    start(async () => {
      apply(optimistic);
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  };

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const matches = (t: WorkTask) => (filter === "all" ? true : filter === "none" ? !t.project_id : t.project_id === filter);
  const filtered = state.open.filter(matches);
  const buckets = bucketTasks(filtered, today);
  const list = buckets[bucket];
  const meta = BUCKETS.find((b) => b.value === bucket)!;
  const activeProjects = projects.filter((p) => p.status === "active" || p.id === projectId);

  // "Todos": agrupa por projeto (fazendo primeiro dentro de cada grupo).
  const groups = (() => {
    const sorted = [...list].sort((a, b) => Number(b.status === "doing") - Number(a.status === "doing"));
    if (filter !== "all") return [{ key: filter, project: projectById.get(filter) ?? null, tasks: sorted }];
    const m = new Map<string, WorkTask[]>();
    for (const t of sorted) m.set(t.project_id ?? "none", [...(m.get(t.project_id ?? "none") ?? []), t]);
    const order = [...projects.map((p) => p.id), "none"];
    return [...m.entries()]
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([key, tasks]) => ({ key, project: projectById.get(key) ?? null, tasks }));
  })();

  const runningTaskId = focus?.view.mode === "timer" || focus?.view.mode === "pomodoro" ? focus.view.entry.task_id : null;

  const counts = new Map<string, number>();
  for (const t of state.open) counts.set(t.project_id ?? "none", (counts.get(t.project_id ?? "none") ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <QuickAdd
        today={today}
        defaultDue={bucket === "hoje" ? today : null}
        projects={activeProjects}
        defaultProject={projectId ?? (filter !== "all" && filter !== "none" ? filter : null)}
        onError={setError}
      />

      {!projectId && projects.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0" aria-label="Filtrar por projeto">
          <FilterChip on={filter === "all"} onClick={() => setFilter("all")} label="Todos" n={state.open.length} />
          {activeProjects.map((p) => (
            <FilterChip key={p.id} on={filter === p.id} onClick={() => setFilter(p.id)} label={p.name} n={counts.get(p.id) ?? 0} hex={projectHex(p.color)} />
          ))}
          {(counts.get("none") ?? 0) > 0 && (
            <FilterChip on={filter === "none"} onClick={() => setFilter("none")} label="Sem projeto" n={counts.get("none") ?? 0} hex={projectHex(null)} />
          )}
        </div>
      )}

      <div role="tablist" aria-label="Quando" className="flex gap-1.5">
        {BUCKETS.map((b) => {
          const on = b.value === bucket;
          const n = buckets[b.value].length;
          const late = b.value === "hoje" && buckets.hoje.some((t) => isOverdue(t, today));
          return (
            <button
              key={b.value}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setBucket(b.value)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                on ? "border-line-strong bg-white/[0.07] text-text-0" : "border-line text-text-2 hover:text-text-1",
              )}
            >
              {b.label}
              <span className={cn("num text-xs", late ? "text-ember" : on ? "text-text-1" : "text-text-2")}>{n}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      {list.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">{meta.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.project?.name ?? "Sem projeto"}>
              {filter === "all" && (
                <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-text-1">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: projectHex(g.project?.color) }} />
                  {g.project?.name ?? "Sem projeto"}
                  <span className="num text-text-2">{g.tasks.length}</span>
                </h3>
              )}
              <ul className="flex flex-col gap-2">
                {g.tasks.map((t) =>
                  editing === t.id ? (
                    <li key={t.id} className="edge-light rounded-md border border-volt/30 bg-bg-2/80 p-3">
                      <TaskEditor task={t} projects={activeProjects} onDone={() => setEditing(null)} onError={setError} />
                    </li>
                  ) : (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={today}
                      running={runningTaskId === t.id}
                      canFocus={Boolean(focus)}
                      onDone={() => run({ type: "done", id: t.id }, () => setTaskDone(t.id, true))}
                      onToggleDoing={() => run({ type: "doing", id: t.id, doing: t.status !== "doing" }, () => setTaskDoing(t.id, t.status !== "doing"))}
                      onFocus={() => focus?.start({ kind: "pomodoro", task_id: t.id, project_id: t.project_id, label: t.title })}
                      onEdit={() => setEditing(t.id)}
                    />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      {state.doneToday.filter(matches).length > 0 && (
        <section aria-label="Feitas hoje" className="mt-2">
          <h3 className="label-instrument mb-2">Feitas hoje · {state.doneToday.filter(matches).length}</h3>
          <ul className="flex flex-col">
            {state.doneToday.filter(matches).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1.5">
                <button
                  type="button"
                  aria-label={`Reabrir: ${t.title}`}
                  onClick={() => run({ type: "undone", task: t }, () => setTaskDone(t.id, false))}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-volt text-bg-0 shadow-[0_0_10px_rgba(200,255,46,0.45)] transition-transform duration-150 active:scale-90"
                >
                  <Check size={14} strokeWidth={2.5} />
                </button>
                <span className="min-w-0 truncate text-sm text-text-2 line-through decoration-text-2/60">{t.title}</span>
                {t.trackedMinutes > 0 && <span className="num ml-auto shrink-0 text-xs text-text-2">{fmtHours(t.trackedMinutes)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilterChip({ on, onClick, label, n, hex }: { on: boolean; onClick: () => void; label: string; n: number; hex?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
        on ? "border-line-strong bg-white/[0.08] text-text-0" : "border-line text-text-2 hover:text-text-1",
      )}
      style={on && hex ? { borderColor: `${hex}80`, background: `${hex}1a` } : undefined}
    >
      {hex && <span aria-hidden className="size-2 rounded-full" style={{ background: hex }} />}
      {label}
      <span className="num text-text-2">{n}</span>
    </button>
  );
}

function TaskRow({
  task,
  today,
  running,
  canFocus,
  onDone,
  onToggleDoing,
  onFocus,
  onEdit,
}: {
  task: WorkTask;
  today: string;
  running: boolean;
  canFocus: boolean;
  onDone: () => void;
  onToggleDoing: () => void;
  onFocus: () => void;
  onEdit: () => void;
}) {
  const late = isOverdue(task, today);
  const doing = task.status === "doing";
  const est = task.estimate_minutes;
  const over = est !== null && task.trackedMinutes > est;
  return (
    <li
      className={cn(
        "edge-light flex items-start gap-3 rounded-md border bg-bg-2/80 p-3 transition-[border-color] duration-150",
        running ? "border-plasma/60 shadow-[0_0_16px_rgba(124,92,255,0.18)]" : doing ? "border-plasma/30" : "border-line",
      )}
    >
      <button
        type="button"
        aria-label={`Concluir: ${task.title}`}
        onClick={onDone}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-[border-color,background-color,transform] duration-150 hover:border-volt hover:bg-volt/10 active:scale-90",
          task.moves_revenue ? "border-volt/60" : "border-line-strong",
        )}
      />
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
        <span className="text-sm text-text-0">{task.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {doing && <span className="text-plasma">{running ? "focando agora" : "fazendo"}</span>}
          {task.due_on && (
            <span className={cn("num", late ? "text-ember" : "text-text-2")}>
              {late ? "atrasada · " : ""}
              {dueLabel(task.due_on, today)}
            </span>
          )}
          {(est || task.trackedMinutes > 0) && (
            <span className={cn("num flex items-center gap-1", over ? "text-ember" : "text-text-2")}>
              <Clock3 size={11} strokeWidth={1.5} aria-hidden />
              {fmtHours(task.trackedMinutes)}
              {est ? ` / ${fmtHours(est)}` : ""}
            </span>
          )}
          {task.moves_revenue && (
            <span className="flex items-center gap-1 text-volt">
              <CircleDollarSign size={12} strokeWidth={1.5} aria-hidden /> faturamento
            </span>
          )}
        </span>
        {est ? (
          <span aria-hidden className="mt-0.5 h-1 w-full max-w-40 overflow-hidden rounded-full bg-white/5">
            <span
              className={cn("block h-full origin-left rounded-full", over ? "bg-ember" : "bg-plasma")}
              style={{ transform: `scaleX(${Math.min(1, task.trackedMinutes / est)})` }}
            />
          </span>
        ) : null}
      </button>
      <div className="-mr-1 flex shrink-0 items-center">
        <button
          type="button"
          aria-label={doing ? `Voltar para a fazer: ${task.title}` : `Marcar como fazendo: ${task.title}`}
          aria-pressed={doing}
          onClick={onToggleDoing}
          className={cn(
            "hidden h-8 items-center rounded-full px-2 text-xs transition-[color,background-color,transform] duration-150 active:scale-90 sm:flex",
            doing ? "text-plasma" : "text-text-2 hover:text-text-0",
          )}
        >
          {doing ? "fazendo" : "a fazer"}
        </button>
        {canFocus && !running && (
          <button
            type="button"
            aria-label={`Focar em ${task.title}`}
            onClick={onFocus}
            className="flex size-8 items-center justify-center rounded-full text-plasma transition-[background-color,transform] duration-150 hover:bg-plasma/15 active:scale-90"
          >
            <Play size={15} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          aria-label={`Editar: ${task.title}`}
          onClick={onEdit}
          className="flex size-8 items-center justify-center rounded-sm text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
        >
          <Pencil size={15} strokeWidth={1.5} />
        </button>
      </div>
    </li>
  );
}

function ProjectSelect({ projects, value, onChange, className }: { projects: Project[]; value: string; onChange: (v: string) => void; className?: string }) {
  const hex = projectHex(projects.find((p) => p.id === value)?.color);
  return (
    <span className={cn("relative flex items-center", className)}>
      <span aria-hidden className="pointer-events-none absolute left-3 size-2 rounded-full" style={{ background: hex }} />
      <select
        aria-label="Projeto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full appearance-none rounded-full border border-line bg-white/[0.04] pr-3 pl-7 text-xs text-text-1 focus:border-volt/50 focus:outline-none"
      >
        <option value="">Sem projeto</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </span>
  );
}

function QuickAdd({
  today,
  defaultDue,
  projects,
  defaultProject,
  onError,
}: {
  today: string;
  defaultDue: string | null;
  projects: Project[];
  defaultProject: string | null;
  onError: (e: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<"none" | "hoje" | "amanha" | "data">(defaultDue ? "hoje" : "none");
  const [date, setDate] = useState(today);
  const [money, setMoney] = useState(false);
  const [project, setProject] = useState<string>(defaultProject ?? "");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [pending, start] = useTransition();

  // Trocar o filtro de projeto muda o projeto da nova tarefa.
  const [lastDefault, setLastDefault] = useState(defaultProject);
  if (defaultProject !== lastDefault) {
    setLastDefault(defaultProject);
    setProject(defaultProject ?? "");
  }

  const dueOn = due === "hoje" ? today : due === "amanha" ? addDays(today, 1) : due === "data" ? date : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onError(null);
    start(async () => {
      const r = await createTask({ title, due_on: dueOn, moves_revenue: money, project_id: project || null, estimate_minutes: estimate });
      if (r.ok) {
        setTitle("");
        setMoney(false);
        setEstimate(null);
      } else onError(r.error);
    });
  }

  const pill = (on: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
      on ? "border-volt/50 bg-volt/10 text-volt" : "border-line text-text-2 hover:text-text-1",
    );

  return (
    <form onSubmit={submit} className="glass edge-light flex flex-col gap-2.5 rounded-md border border-line p-3">
      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa…" aria-label="Nova tarefa" maxLength={200} className={field} />
        <Button type="submit" disabled={pending || !title.trim()} aria-label="Adicionar tarefa" className="w-11 shrink-0 px-0">
          <Plus size={20} strokeWidth={2} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {projects.length > 0 && <ProjectSelect projects={projects} value={project} onChange={setProject} className="w-full sm:w-44" />}
        {(
          [
            ["none", "Sem prazo"],
            ["hoje", "Hoje"],
            ["amanha", "Amanhã"],
            ["data", "Data"],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={due === v} onClick={() => setDue(v)} className={pill(due === v)}>
            {l}
          </button>
        ))}
        {due === "data" && (
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Prazo"
            className="num h-8 rounded-full border border-line bg-white/[0.04] px-3 text-sm text-text-0 focus:border-volt/50 focus:outline-none"
          />
        )}
      </div>
      {title.trim() && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-text-2">Estimativa</span>
          {ESTIMATES.map((m) => (
            <button key={m} type="button" aria-pressed={estimate === m} onClick={() => setEstimate(estimate === m ? null : m)} className={pill(estimate === m)}>
              {fmtHours(m)}
            </button>
          ))}
          <button type="button" aria-pressed={money} onClick={() => setMoney(!money)} className={cn(pill(money), "sm:ml-auto")}>
            <CircleDollarSign size={13} strokeWidth={1.5} aria-hidden /> Faturamento
          </button>
        </div>
      )}
    </form>
  );
}

function TaskEditor({
  task,
  projects,
  onDone,
  onError,
}: {
  task: WorkTask;
  projects: Project[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_on ?? "");
  const [money, setMoney] = useState(task.moves_revenue);
  const [project, setProject] = useState(task.project_id ?? "");
  const [estimate, setEstimate] = useState(task.estimate_minutes ? String(task.estimate_minutes) : "");
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<ActionResult>) => {
    onError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) onDone();
      else onError(r.error);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const est = estimate.trim() ? Math.round(Number(estimate)) : null;
        act(() =>
          updateTask(task.id, {
            title,
            due_on: due || null,
            moves_revenue: money,
            priority: task.priority,
            project_id: project || null,
            estimate_minutes: est && est > 0 ? est : null,
          }),
        );
      }}
      className="flex flex-col gap-2.5"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tarefa" maxLength={200} className={field} autoFocus />
      <div className="flex flex-wrap items-center gap-2">
        {projects.length > 0 && <ProjectSelect projects={projects} value={project} onChange={setProject} className="w-full sm:w-44" />}
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Prazo"
          className="num h-9 rounded-full border border-line bg-white/[0.04] px-3 text-sm text-text-0 focus:border-volt/50 focus:outline-none"
        />
        {due && (
          <button type="button" onClick={() => setDue("")} className="h-9 rounded-full px-3 text-xs text-text-2 hover:text-text-0">
            Sem prazo
          </button>
        )}
        <label className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-text-2">
          <Clock3 size={13} strokeWidth={1.5} aria-hidden />
          <input
            value={estimate}
            onChange={(e) => setEstimate(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="est."
            aria-label="Estimativa em minutos"
            className="num w-10 bg-transparent text-sm text-text-0 focus:outline-none"
          />
          min
        </label>
        <button
          type="button"
          aria-pressed={money}
          onClick={() => setMoney(!money)}
          className={cn(
            "flex h-9 items-center gap-1 rounded-full border px-3 text-xs transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
            money ? "border-volt/50 bg-volt/10 text-volt" : "border-line text-text-2",
          )}
        >
          <CircleDollarSign size={13} strokeWidth={1.5} aria-hidden /> Faturamento
        </button>
      </div>
      {task.trackedMinutes > 0 && <p className="num text-xs text-text-2">Registrado até agora: {fmtHours(task.trackedMinutes)}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !title.trim()}>
          Salvar
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={() => (confirmDrop ? act(() => dropTask(task.id)) : setConfirmDrop(true))}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-text-2 transition-[color,transform] duration-150 hover:text-flare active:scale-95"
        >
          <Trash2 size={14} strokeWidth={1.5} />
          {confirmDrop ? "Confirmar" : "Descartar"}
        </button>
      </div>
    </form>
  );
}
