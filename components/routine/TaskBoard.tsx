"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Check, CircleDollarSign, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import type { Task } from "@/lib/data/routine";
import { bucketTasks, isOverdue, type TaskBucket } from "@/lib/metrics/routine";
import { createTask, dropTask, setTaskDone, updateTask, type ActionResult } from "@/app/(app)/rotina/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

const BUCKETS: { value: TaskBucket; label: string; empty: string }[] = [
  { value: "hoje", label: "Hoje", empty: "Nada pra hoje. Puxa algo da semana ou do backlog." },
  { value: "semana", label: "Semana", empty: "Nada nos próximos 7 dias." },
  { value: "backlog", label: "Backlog", empty: "Backlog vazio." },
];

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function dueLabel(due: string, today: string): string {
  if (due === today) return "hoje";
  if (due === addDays(today, 1)) return "amanhã";
  if (due === addDays(today, -1)) return "ontem";
  const d = new Date(`${due}T12:00:00Z`);
  return `${WD[d.getUTCDay()]} ${due.slice(8, 10)}/${due.slice(5, 7)}`;
}

type Optimistic = { type: "done"; id: string } | { type: "undone"; task: Task } | { type: "drop"; id: string };

export function TaskBoard({ open, doneToday, today }: { open: Task[]; doneToday: Task[]; today: string }) {
  const [bucket, setBucket] = useState<TaskBucket>("hoje");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // Marcar como feita some da lista na hora; o servidor confirma depois.
  const [state, apply] = useOptimistic({ open, doneToday }, (s, a: Optimistic) => {
    if (a.type === "done") {
      const t = s.open.find((x) => x.id === a.id);
      return t
        ? { open: s.open.filter((x) => x.id !== a.id), doneToday: [{ ...t, status: "done" as const }, ...s.doneToday] }
        : s;
    }
    if (a.type === "undone") {
      return { open: [...s.open, { ...a.task, status: "todo" as const }], doneToday: s.doneToday.filter((x) => x.id !== a.task.id) };
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

  const buckets = bucketTasks(state.open, today);
  const list = buckets[bucket];
  const meta = BUCKETS.find((b) => b.value === bucket)!;

  return (
    <div className="flex flex-col gap-4">
      <QuickAdd today={today} defaultDue={bucket === "hoje" ? today : null} onError={setError} />

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
        <ul className="flex flex-col gap-2">
          {list.map((t) =>
            editing === t.id ? (
              <li key={t.id} className="edge-light rounded-md border border-volt/30 bg-bg-2/80 p-3">
                <TaskEditor task={t} onDone={() => setEditing(null)} onError={setError} />
              </li>
            ) : (
              <TaskRow
                key={t.id}
                task={t}
                today={today}
                onDone={() => run({ type: "done", id: t.id }, () => setTaskDone(t.id, true))}
                onEdit={() => setEditing(t.id)}
              />
            ),
          )}
        </ul>
      )}

      {state.doneToday.length > 0 && (
        <section aria-label="Feitas hoje" className="mt-2">
          <h3 className="label-instrument mb-2">Feitas hoje · {state.doneToday.length}</h3>
          <ul className="flex flex-col">
            {state.doneToday.map((t) => (
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TaskRow({ task, today, onDone, onEdit }: { task: Task; today: string; onDone: () => void; onEdit: () => void }) {
  const late = isOverdue(task, today);
  return (
    <li className="edge-light flex items-start gap-3 rounded-md border border-line bg-bg-2/80 p-3">
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
        {(task.due_on || task.moves_revenue) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {task.due_on && (
              <span className={cn("num", late ? "text-ember" : "text-text-2")}>
                {late ? "atrasada · " : ""}
                {dueLabel(task.due_on, today)}
              </span>
            )}
            {task.moves_revenue && (
              <span className="flex items-center gap-1 text-volt">
                <CircleDollarSign size={12} strokeWidth={1.5} aria-hidden /> faturamento
              </span>
            )}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={`Editar: ${task.title}`}
        onClick={onEdit}
        className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-sm text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
      >
        <Pencil size={15} strokeWidth={1.5} />
      </button>
    </li>
  );
}

function QuickAdd({ today, defaultDue, onError }: { today: string; defaultDue: string | null; onError: (e: string | null) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<"none" | "hoje" | "amanha" | "data">(defaultDue ? "hoje" : "none");
  const [date, setDate] = useState(today);
  const [money, setMoney] = useState(false);
  const [pending, start] = useTransition();

  const dueOn = due === "hoje" ? today : due === "amanha" ? addDays(today, 1) : due === "data" ? date : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onError(null);
    start(async () => {
      const r = await createTask({ title, due_on: dueOn, moves_revenue: money });
      if (r.ok) {
        setTitle("");
        setMoney(false);
      } else onError(r.error);
    });
  }

  const pill = (on: boolean) =>
    cn(
      "flex h-8 items-center gap-1 rounded-full border px-3 text-xs transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
      on ? "border-volt/50 bg-volt/10 text-volt" : "border-line text-text-2 hover:text-text-1",
    );

  return (
    <form onSubmit={submit} className="glass edge-light flex flex-col gap-2.5 rounded-md border border-line p-3">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa…"
          aria-label="Nova tarefa"
          maxLength={200}
          className={field}
        />
        <Button type="submit" disabled={pending || !title.trim()} aria-label="Adicionar tarefa" className="w-11 shrink-0 px-0">
          <Plus size={20} strokeWidth={2} />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
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
        <button type="button" aria-pressed={money} onClick={() => setMoney(!money)} className={cn(pill(money), "sm:ml-auto")}>
          <CircleDollarSign size={13} strokeWidth={1.5} aria-hidden /> Mexe no faturamento
        </button>
      </div>
    </form>
  );
}

function TaskEditor({ task, onDone, onError }: { task: Task; onDone: () => void; onError: (e: string | null) => void }) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_on ?? "");
  const [money, setMoney] = useState(task.moves_revenue);
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
        act(() => updateTask(task.id, { title, due_on: due || null, moves_revenue: money, priority: task.priority }));
      }}
      className="flex flex-col gap-2.5"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tarefa" maxLength={200} className={field} autoFocus />
      <div className="flex flex-wrap items-center gap-2">
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
