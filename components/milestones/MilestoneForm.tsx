"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { MilestoneMetric } from "@/lib/metrics/milestone-value";
import { isMonthlyMetric } from "@/lib/metrics/milestones";
import { parseBRL } from "@/lib/money";
import { createMilestone, updateMilestone, type ActionResult } from "@/app/(app)/marcos/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

const METRICS: { value: MilestoneMetric; label: string; hint: string }[] = [
  { value: "revenue_month", label: "Receita do mês", hint: "Soma das receitas no mês." },
  { value: "net_month", label: "Saldo do mês", hint: "Receitas menos despesas no mês." },
  { value: "revenue_cumulative", label: "Receita acumulada", hint: "Tudo que já entrou, desde sempre." },
  { value: "mrr", label: "Mensalidades ativas", hint: "Clientes de mensalidade fechados (conta a partir da Fase 3)." },
];

export interface MilestoneFormValues {
  title: string;
  metric: MilestoneMetric;
  target: string;
  month: string;
  deadline: string | null;
}

export function MilestoneForm({
  milestoneId,
  initial,
  months,
  today,
  onDone,
}: {
  /** Sem id = criar. */
  milestoneId?: string;
  initial?: MilestoneFormValues;
  months: { value: string; label: string }[];
  today: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [metric, setMetric] = useState<MilestoneMetric>(initial?.metric ?? "revenue_month");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [month, setMonth] = useState(initial?.month ?? months[0]?.value ?? "recorrente");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const monthly = isMonthlyMetric(metric);
  const targetValid = (parseBRL(target) ?? 0) > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Dê um nome ao marco.");
    if (!targetValid) return setError("Meta inválida.");
    setError(null);
    const input = {
      title,
      metric,
      target,
      month: monthly ? month : null,
      deadline: monthly ? null : deadline || null,
    };
    start(async () => {
      const r: ActionResult = milestoneId ? await updateMilestone(milestoneId, input) : await createMilestone(input);
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="label-instrument">Nome</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Primeiros R$ 20k/mês"
          maxLength={80}
          className={field}
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="label-instrument mb-1">Métrica</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={metric === m.value}
              onClick={() => setMetric(m.value)}
              className={cn(
                "min-h-10 rounded-sm border px-2 py-2 text-left text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                metric === m.value
                  ? "border-volt/50 bg-volt/10 text-volt shadow-[0_0_12px_rgba(200,255,46,0.15)]"
                  : "border-line text-text-1 hover:border-line-strong",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-2">{METRICS.find((m) => m.value === metric)?.hint}</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Meta (R$)</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="20.000"
            autoComplete="off"
            className={cn(field, "num", target && !targetValid && "border-flare/60")}
          />
        </label>
        {monthly ? (
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label-instrument">Mês</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={field}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              <option value="recorrente">Todo mês</option>
            </select>
          </label>
        ) : (
          <label className="flex min-w-0 flex-col gap-1">
            <span className="label-instrument">Prazo (opcional)</span>
            <input
              type="date"
              value={deadline}
              min={today}
              onChange={(e) => setDeadline(e.target.value)}
              className={cn(field, "num")}
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {milestoneId ? "Salvar" : "Criar marco"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
