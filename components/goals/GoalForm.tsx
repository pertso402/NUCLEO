"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Goal } from "@/lib/data/goals";
import { AREAS, formatDecimal, quarterLabel, type GoalArea } from "@/lib/metrics/goals";
import { createGoal, updateGoal, type ActionResult } from "@/app/(app)/objetivos/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-plasma/60 focus:outline-none";

export function GoalForm({
  goal,
  quarter,
  quarters,
  onDone,
}: {
  /** Sem objetivo = criar. */
  goal?: Goal;
  quarter: string;
  quarters: string[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [area, setArea] = useState<GoalArea>(goal?.area ?? "dinheiro");
  const [why, setWhy] = useState(goal?.why ?? "");
  const [q, setQ] = useState(goal?.quarter ?? quarter);
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [metricLabel, setMetricLabel] = useState(goal?.metric_label ?? "");
  const [metricTarget, setMetricTarget] = useState(formatDecimal(goal?.metric_target));
  const [metricCurrent, setMetricCurrent] = useState(formatDecimal(goal?.metric_current));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      title,
      area,
      why,
      quarter: q,
      target_date: targetDate || null,
      metric_label: metricLabel,
      metric_target: metricTarget,
      metric_current: metricCurrent,
    };
    start(async () => {
      const r: ActionResult = goal ? await updateGoal(goal.id, input) : await createGoal(input);
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  const options = quarters.includes(q) ? quarters : [q, ...quarters];

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="label-instrument">Objetivo</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fechar 5 clientes de mensalidade"
          maxLength={120}
          className={field}
          autoFocus
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="label-instrument mb-1">Área</legend>
        <div className="flex flex-wrap gap-1.5">
          {AREAS.map((a) => (
            <button
              key={a.value}
              type="button"
              aria-pressed={area === a.value}
              onClick={() => setArea(a.value)}
              className={cn(
                "flex h-9 items-center rounded-full border px-3 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                area === a.value ? "border-plasma/60 bg-plasma/15 text-text-0" : "border-line text-text-2 hover:text-text-1",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="label-instrument">Por quê</span>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="O que muda na sua vida quando isso acontecer?"
          maxLength={500}
          rows={2}
          className={cn(field, "h-auto py-2.5 leading-snug")}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Trimestre</span>
          <select value={q} onChange={(e) => setQ(e.target.value)} className={field}>
            {options.map((o) => (
              <option key={o} value={o}>
                {quarterLabel(o).split(" · ")[0]} {o.slice(0, 4)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Data alvo</span>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={cn(field, "num")} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="label-instrument mb-1">Métrica (opcional)</legend>
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2">
          <input
            value={metricLabel}
            onChange={(e) => setMetricLabel(e.target.value)}
            placeholder="clientes"
            aria-label="O que medir"
            maxLength={60}
            className={field}
          />
          <input
            value={metricCurrent}
            onChange={(e) => setMetricCurrent(e.target.value)}
            placeholder="atual"
            aria-label="Valor atual"
            inputMode="decimal"
            className={cn(field, "num")}
          />
          <input
            value={metricTarget}
            onChange={(e) => setMetricTarget(e.target.value)}
            placeholder="meta"
            aria-label="Meta"
            inputMode="decimal"
            className={cn(field, "num")}
          />
        </div>
        <p className="text-xs text-text-2">Ex.: 2 de 5 clientes, 8 de 12 livros, 72 de 80 kg.</p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="focus" disabled={pending || !title.trim()}>
          {goal ? "Salvar" : "Criar objetivo"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
