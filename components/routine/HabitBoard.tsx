"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Archive, Check, Flame, Pencil, Plus } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Habit } from "@/lib/data/routine";
import { heatmapWeeks, lastDays } from "@/lib/metrics/routine";
import { archiveHabit, createHabit, setHabitDay, updateHabit, type ActionResult } from "@/app/(app)/rotina/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

const WD1 = ["D", "S", "T", "Q", "Q", "S", "S"];
const dayNum = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Opacidade do Volt por intensidade (classes explícitas para o Tailwind gerar). */
function heatClass(level: number, future: boolean): string {
  if (future) return "bg-transparent border border-line/60";
  if (level <= 0) return "bg-bg-3";
  if (level < 0.34) return "bg-volt/25";
  if (level < 0.67) return "bg-volt/50";
  if (level < 1) return "bg-volt/75";
  return "bg-volt shadow-[0_0_8px_rgba(200,255,46,0.55)]";
}

type Toggle = { habitId: string; date: string; done: boolean };

export function HabitBoard({ habits, logs, today }: { habits: Habit[]; logs: Record<string, string[]>; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(habits.length === 0 ? "new" : null);
  const [, start] = useTransition();

  const [optLogs, apply] = useOptimistic(logs, (s, t: Toggle) => {
    const cur = new Set(s[t.habitId] ?? []);
    if (t.done) cur.add(t.date);
    else cur.delete(t.date);
    return { ...s, [t.habitId]: [...cur] };
  });

  const toggle = (t: Toggle) => {
    setError(null);
    start(async () => {
      apply(t);
      const r = await setHabitDay(t.habitId, t.date, t.done);
      if (!r.ok) setError(r.error);
    });
  };

  const perDay = new Map<string, number>();
  for (const h of habits) for (const d of optLogs[h.id] ?? []) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  const grid = heatmapWeeks(perDay, today, habits.length);
  const week = lastDays(today, 7);
  const doneToday = habits.filter((h) => optLogs[h.id]?.includes(today)).length;

  return (
    <div className="flex flex-col gap-4">
      <HudCard
        label="Últimas 12 semanas"
        accent="volt"
        action={
          habits.length > 0 && (
            <span className="num text-xs text-text-2">
              hoje <span className={doneToday > 0 ? "neon-volt" : undefined}>{doneToday}</span>/{habits.length}
            </span>
          )
        }
      >
        <div className="flex max-w-md gap-2">
          <div aria-hidden className="num grid grid-rows-7 gap-[3px] pt-px text-[9px] leading-3 text-text-2">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
              <span key={i} className={i % 2 ? "opacity-0" : undefined}>
                {d}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={`Mapa de hábitos: ${[...perDay.values()].reduce((a, b) => a + b, 0)} marcações em 12 semanas`}
            className="grid flex-1 grid-flow-col grid-cols-12 grid-rows-7 gap-[3px]"
          >
            {grid.flat().map((c) => (
              <span
                key={c.date}
                title={c.future ? undefined : `${fmt(c.date)}: ${c.count} de ${habits.length}`}
                className={cn("aspect-square w-full max-w-4 justify-self-center rounded-[3px]", heatClass(c.level, c.future), c.date === today && "ring-1 ring-text-1/60")}
              />
            ))}
          </div>
        </div>
      </HudCard>

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="label-instrument">Hábitos</h2>
        {editing !== "new" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex h-9 items-center gap-1.5 rounded-full border border-volt/40 bg-volt/10 px-3.5 text-sm text-volt shadow-[0_0_12px_rgba(200,255,46,0.15)] transition-[box-shadow,transform] duration-150 hover:shadow-glow-volt active:scale-95"
          >
            <Plus size={16} strokeWidth={2} /> Novo hábito
          </button>
        )}
      </div>

      {editing === "new" && (
        <section className="glass edge-light rounded-md border border-volt/30 p-4">
          <HabitForm onDone={() => setEditing(null)} onError={setError} />
        </section>
      )}

      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {habits.map((h) => {
          const days = new Set(optLogs[h.id] ?? []);
          const record = h.current_streak >= 2 && h.current_streak >= h.best_streak;
          const unit = h.unit === "week" ? (h.current_streak === 1 ? "semana" : "semanas") : h.current_streak === 1 ? "dia" : "dias";
          const thisWeek = week.filter((d) => days.has(d)).length;
          if (editing === h.id) {
            return (
              <li key={h.id} className="edge-light rounded-md border border-volt/30 bg-bg-2/80 p-3">
                <HabitForm habit={h} onDone={() => setEditing(null)} onError={setError} />
              </li>
            );
          }
          return (
            <li key={h.id} className="edge-light rounded-md border border-line bg-bg-2/80 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-0">{h.name}</p>
                  <p className="num mt-0.5 text-xs leading-5 text-text-2">
                    {h.current_streak > 0 ? (
                      <>
                        <Flame
                          size={12}
                          strokeWidth={1.5}
                          className={cn("-mt-0.5 mr-1 inline", record ? "text-gold" : "text-volt")}
                          aria-hidden
                        />
                        <span className={cn("whitespace-nowrap", record ? "neon-gold" : "neon-volt")}>
                          {h.current_streak} {unit}
                        </span>
                        <span className="whitespace-nowrap">{record ? " · recorde" : ` · recorde ${h.best_streak}`}</span>
                      </>
                    ) : (
                      <span>{h.best_streak > 0 ? `sequência zerada · recorde ${h.best_streak}` : "sem sequência ainda"}</span>
                    )}
                    {h.target_per_week < 7 && (
                      <span className="block">
                        meta {h.target_per_week}x/sem · {thisWeek} nos últimos 7 dias
                      </span>
                    )}
                  </p>
                </div>
                <div className="-mt-1 -mr-1 flex shrink-0">
                  <IconBtn label={`Editar ${h.name}`} onClick={() => setEditing(h.id)}>
                    <Pencil size={15} strokeWidth={1.5} />
                  </IconBtn>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {week.map((d) => {
                  const on = days.has(d);
                  const isToday = d === today;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${h.name} em ${fmt(d)}${isToday ? " (hoje)" : ""}`}
                      onClick={() => toggle({ habitId: h.id, date: d, done: !on })}
                      className={cn(
                        "flex h-11 flex-col items-center justify-center gap-0.5 rounded-sm border text-[10px] transition-[background-color,border-color,transform] duration-150 active:scale-90",
                        on
                          ? "border-volt/60 bg-volt/15 text-volt shadow-[0_0_10px_rgba(200,255,46,0.25)]"
                          : isToday
                            ? "border-line-strong text-text-1"
                            : "border-line text-text-2",
                      )}
                    >
                      <span className="leading-none">{WD1[dayNum(d)]}</span>
                      {on ? <Check size={14} strokeWidth={2.5} /> : <span className="num leading-none">{d.slice(8, 10)}</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-sm text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
    >
      {children}
    </button>
  );
}

function HabitForm({ habit, onDone, onError }: { habit?: Habit; onDone: () => void; onError: (e: string | null) => void }) {
  const [name, setName] = useState(habit?.name ?? "");
  const [target, setTarget] = useState(habit?.target_per_week ?? 7);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<ActionResult>) => {
    onError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) onDone();
      else onError(r.error);
    });
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = { name, target_per_week: target };
    act(() => (habit ? updateHabit(habit.id, input) : createHabit(input)));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="label-instrument">{habit ? "Hábito" : "Novo hábito"}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Academia" maxLength={60} className={field} autoFocus />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="label-instrument mb-1">Meta</legend>
        <div className="flex flex-wrap gap-1.5">
          {[7, 6, 5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={target === n}
              onClick={() => setTarget(n)}
              className={cn(
                "num flex h-9 items-center rounded-full border px-3 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                target === n ? "border-volt/50 bg-volt/10 text-volt" : "border-line text-text-2 hover:text-text-1",
              )}
            >
              {n === 7 ? "Todo dia" : `${n}x/sem`}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-2">
          {target === 7 ? "A sequência conta dias seguidos." : "A sequência conta semanas (seg–dom) em que você bateu a meta."}
        </p>
      </fieldset>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {habit ? "Salvar" : "Criar hábito"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
        {habit && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (confirm ? act(() => archiveHabit(habit.id)) : setConfirm(true))}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-text-2 transition-[color,transform] duration-150 hover:text-text-0 active:scale-95"
          >
            <Archive size={14} strokeWidth={1.5} />
            {confirm ? "Confirmar" : "Arquivar"}
          </button>
        )}
      </div>
    </form>
  );
}
