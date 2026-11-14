"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Check, CircleCheckBig, Minus, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import type { Goal, GoalTask } from "@/lib/data/goals";
import { AREA_LABEL, formatDecimal, goalPace, metricProgress } from "@/lib/metrics/goals";
import { addGoalTask, setGoalMetric, setGoalStatus, type ActionResult } from "@/app/(app)/objetivos/actions";
import { setTaskDone } from "@/app/(app)/rotina/actions";
import { GoalForm } from "./GoalForm";

const PACE = {
  frente: { text: "no ritmo", cls: "text-volt" },
  perto: { text: "quase no ritmo", cls: "text-text-1" },
  atras: { text: "abaixo do ritmo", cls: "text-ember" },
} as const;

export function GoalCard({
  goal,
  elapsed,
  quarter,
  quarters,
  showArea = true,
}: {
  goal: Goal;
  /** Na lista agrupada por área a etiqueta é redundante. */
  showArea?: boolean;
  /** Fração do trimestre que já passou (0..1). */
  elapsed: number;
  quarter: string;
  quarters: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"done" | "dropped" | null>(null);
  const [pending, start] = useTransition();

  const [opt, apply] = useOptimistic(
    { current: goal.metric_current, tasks: goal.tasks },
    (s, a: { current?: number; task?: { id: string; done: boolean } }) => ({
      current: a.current ?? s.current,
      tasks: a.task ? s.tasks.map((t) => (t.id === a.task!.id ? { ...t, status: a.task!.done ? ("done" as const) : ("todo" as const) } : t)) : s.tasks,
    }),
  );

  const run = (fn: () => Promise<ActionResult>, optimistic?: Parameters<typeof apply>[0]) => {
    setError(null);
    start(async () => {
      if (optimistic) apply(optimistic);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  };

  if (editing) {
    return (
      <li className="edge-light rounded-md border border-plasma/40 bg-bg-2/80 p-4">
        <GoalForm goal={goal} quarter={quarter} quarters={quarters} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const active = goal.status === "active";
  const progress = metricProgress(opt.current, goal.metric_target);
  const pace = active ? goalPace(progress, elapsed) : null;
  const done = opt.tasks.filter((t) => t.status === "done").length;
  const step = (delta: number) => {
    const next = Math.max(0, (opt.current ?? 0) + delta);
    run(() => setGoalMetric(goal.id, String(next).replace(".", ",")), { current: next });
  };

  return (
    <li
      className={cn(
        "edge-light relative overflow-hidden rounded-md border bg-bg-2/80 p-4",
        goal.status === "done" ? "border-volt/30" : goal.status === "dropped" ? "border-line opacity-70" : "border-line",
      )}
    >
      <span aria-hidden className="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-plasma/70 to-transparent" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {showArea && (
              <Chip tone="category" className="h-5">
                {AREA_LABEL[goal.area]}
              </Chip>
            )}
            {goal.status === "done" && (
              <Chip tone="category" className="h-5 border-volt/40 text-volt">
                concluído
              </Chip>
            )}
            {goal.target_date && (
              <span className="num text-xs text-text-2">
                até {goal.target_date.slice(8, 10)}/{goal.target_date.slice(5, 7)}
              </span>
            )}
          </div>
          <h3 className={cn("text-base font-semibold text-text-0", goal.status === "dropped" && "line-through decoration-text-2/60")}>
            {goal.title}
          </h3>
        </div>
        {active && (
          <button
            type="button"
            aria-label={`Editar ${goal.title}`}
            onClick={() => setEditing(true)}
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-sm text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
          >
            <Pencil size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {goal.why && <p className="mt-2 border-l-2 border-plasma/40 pl-3 text-sm text-text-1 italic">{goal.why}</p>}

      {goal.metric_target !== null && progress !== null && (
        <div className="mt-4">
          <div className="flex items-end justify-between gap-2">
            <p className="num text-sm text-text-2">
              <span className="text-2xl font-medium text-text-0 [text-shadow:0_0_14px_rgba(124,92,255,0.45)]">{formatDecimal(opt.current ?? 0)}</span>{" "}
              de {formatDecimal(goal.metric_target)} {goal.metric_label}
            </p>
            {active && (
              <div className="flex shrink-0 gap-1">
                <StepBtn label="Diminuir 1" disabled={pending || (opt.current ?? 0) <= 0} onClick={() => step(-1)}>
                  <Minus size={16} strokeWidth={2} />
                </StepBtn>
                <StepBtn label="Somar 1" disabled={pending} onClick={() => step(1)} strong>
                  <Plus size={16} strokeWidth={2} />
                </StepBtn>
              </div>
            )}
          </div>
          <div className="relative mt-2 h-1.5 rounded-full bg-white/[0.06]">
            <div
              className="h-full origin-left rounded-full bg-plasma shadow-glow-plasma transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${Math.min(progress, 1)})` }}
            />
            {active && (
              <span
                aria-hidden
                title="Onde deveria estar hoje"
                className="absolute -top-1 h-3.5 w-px bg-text-2"
                style={{ left: `${Math.min(elapsed, 1) * 100}%` }}
              />
            )}
          </div>
          <p className="num mt-1.5 flex justify-between text-xs text-text-2">
            <span>{Math.floor(progress * 100)}%</span>
            {pace && <span className={PACE[pace].cls}>{PACE[pace].text}</span>}
          </p>
        </div>
      )}

      {(opt.tasks.length > 0 || active) && (
        <section className="mt-4 border-t border-line pt-3">
          <p className="label-instrument mb-2">
            Tarefas{opt.tasks.length > 0 && <span className="num normal-case"> · {done}/{opt.tasks.length}</span>}
          </p>
          <ul className="flex flex-col">
            {opt.tasks.map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                disabled={!active}
                onToggle={() =>
                  run(() => setTaskDone(t.id, t.status !== "done"), { task: { id: t.id, done: t.status !== "done" } })
                }
              />
            ))}
          </ul>
          {active && <AddTask onAdd={(title) => run(() => addGoalTask(goal.id, title))} pending={pending} />}
        </section>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-flare">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-1 border-t border-line pt-2">
        {active ? (
          <>
            <TextBtn
              disabled={pending}
              onClick={() => (confirm === "dropped" ? run(() => setGoalStatus(goal.id, "dropped")) : setConfirm("dropped"))}
            >
              <X size={14} strokeWidth={1.5} /> {confirm === "dropped" ? "Confirmar" : "Deixar de lado"}
            </TextBtn>
            <TextBtn
              disabled={pending}
              onClick={() => (confirm === "done" ? run(() => setGoalStatus(goal.id, "done")) : setConfirm("done"))}
              className="text-volt hover:text-volt"
            >
              <CircleCheckBig size={14} strokeWidth={1.5} /> {confirm === "done" ? "Confirmar" : "Concluir"}
            </TextBtn>
          </>
        ) : (
          <TextBtn disabled={pending} onClick={() => run(() => setGoalStatus(goal.id, "active"))}>
            <RotateCcw size={14} strokeWidth={1.5} /> Reabrir
          </TextBtn>
        )}
      </div>
    </li>
  );
}

function TaskLine({ task, onToggle, disabled }: { task: GoalTask; onToggle: () => void; disabled: boolean }) {
  const doneT = task.status === "done";
  return (
    <li className="flex items-center gap-3 py-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-label={`${doneT ? "Reabrir" : "Concluir"}: ${task.title}`}
        aria-pressed={doneT}
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-150 active:scale-90",
          doneT ? "border-volt bg-volt text-bg-0" : "border-line-strong hover:border-volt",
        )}
      >
        {doneT && <Check size={12} strokeWidth={3} />}
      </button>
      <span className={cn("min-w-0 truncate text-sm", doneT ? "text-text-2 line-through decoration-text-2/60" : "text-text-1")}>
        {task.title}
      </span>
    </li>
  );
}

function AddTask({ onAdd, pending }: { onAdd: (title: string) => void; pending: boolean }) {
  const [title, setTitle] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title);
    setTitle("");
  }
  return (
    <form onSubmit={submit} className="mt-1 flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ tarefa deste objetivo"
        aria-label="Nova tarefa do objetivo"
        maxLength={200}
        className="h-9 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 text-base text-text-0 placeholder:text-text-2 focus:border-line focus:bg-white/[0.04] focus:outline-none sm:text-sm"
      />
      {title.trim() && (
        <button type="submit" disabled={pending} className="h-8 shrink-0 rounded-full px-3 text-xs text-plasma hover:bg-plasma/10 active:scale-95">
          Adicionar
        </button>
      )}
    </form>
  );
}

function StepBtn({
  label,
  onClick,
  disabled,
  strong,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-150 active:scale-90 disabled:opacity-30",
        strong ? "border-plasma/60 bg-plasma/15 text-text-0 hover:bg-plasma/25" : "border-line text-text-1 hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

function TextBtn({
  onClick,
  disabled,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-text-2 transition-[color,background-color,transform] duration-150 hover:bg-white/[0.05] hover:text-text-0 active:scale-95 disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}
