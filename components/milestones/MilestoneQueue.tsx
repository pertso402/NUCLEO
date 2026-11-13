"use client";

import { useState, useTransition } from "react";
import { Archive, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { Money } from "@/components/hud/Money";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import type { ActiveMilestone } from "@/lib/data/milestone";
import { METRIC_LABEL } from "@/lib/metrics/milestone-value";
import { choiceFromPeriod, periodLabel } from "@/lib/metrics/milestones";
import { centsToInput } from "@/lib/money";
import { moveMilestone, setMilestoneStatus, type ActionResult } from "@/app/(app)/marcos/actions";
import { MilestoneForm } from "./MilestoneForm";

/**
 * Fila de marcos ativos. O primeiro é o destaque do Comando; ↑/↓ reordena, lápis edita no lugar.
 * O botão "Novo marco" abre o formulário no topo da fila.
 */
export function MilestoneQueue({
  items,
  months,
  today,
}: {
  items: ActiveMilestone[];
  months: { value: string; label: string }[];
  today: string;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(items.length === 0 ? "new" : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-instrument">Fila</h2>
        {editing !== "new" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex h-9 items-center gap-1.5 rounded-full border border-volt/40 bg-volt/10 px-3.5 text-sm text-volt shadow-[0_0_12px_rgba(200,255,46,0.15)] transition-[box-shadow,transform] duration-150 hover:shadow-glow-volt active:scale-95"
          >
            <Plus size={16} strokeWidth={2} />
            Novo marco
          </button>
        )}
      </div>

      {editing === "new" && (
        <section className="glass edge-light rounded-md border border-volt/30 p-4">
          <h3 className="label-instrument mb-3">Novo marco</h3>
          <MilestoneForm months={months} today={today} onDone={() => setEditing(null)} />
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {items.map((m, i) => {
          const pct = Math.min(m.pct, 1);
          return (
            <li
              key={m.id}
              className={cn(
                "edge-light rounded-md border bg-bg-2/80 p-3",
                i === 0 ? "border-volt/30" : "border-line",
              )}
            >
              {editing === m.id ? (
                <MilestoneForm
                  milestoneId={m.id}
                  months={months}
                  today={today}
                  initial={{
                    title: m.title,
                    metric: m.metric,
                    target: centsToInput(m.target_cents),
                    ...choiceFromPeriod(m.metric, m),
                  }}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs",
                      i === 0 ? "border-volt/60 text-volt shadow-[0_0_10px_rgba(200,255,46,0.35)]" : "border-line-strong text-text-2",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium text-text-0">{m.title}</span>
                      {i === 0 && <Chip tone="category" className="h-5 text-volt">em destaque</Chip>}
                    </div>
                    <p className="text-xs text-text-2">
                      {METRIC_LABEL[m.metric]} · {periodLabel(m.metric, m)}
                    </p>
                    <div className="h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full origin-left rounded-full bg-volt shadow-glow-volt"
                        style={{ transform: `scaleX(${pct})` }}
                      />
                    </div>
                    <p className="num flex items-baseline justify-between text-xs text-text-2">
                      <span>
                        <Money cents={m.currentCents} showCents={false} className="text-sm" /> de{" "}
                        <Money cents={m.target_cents} showCents={false} />
                      </span>
                      <span className={pct > 0 ? "neon-volt" : undefined}>{Math.floor(m.pct * 100)}%</span>
                    </p>
                  </div>
                  <div className="-mr-1 flex shrink-0 flex-col items-center">
                    <IconButton label="Subir" disabled={pending || i === 0} onClick={() => run(() => moveMilestone(m.id, -1))}>
                      <ChevronUp size={18} strokeWidth={1.5} />
                    </IconButton>
                    <IconButton
                      label="Descer"
                      disabled={pending || i === items.length - 1}
                      onClick={() => run(() => moveMilestone(m.id, 1))}
                    >
                      <ChevronDown size={18} strokeWidth={1.5} />
                    </IconButton>
                  </div>
                </div>
              )}
              {editing !== m.id && (
                <div className="mt-2 flex justify-end gap-1 border-t border-line pt-2">
                  <TextButton onClick={() => setEditing(m.id)} disabled={pending}>
                    <Pencil size={14} strokeWidth={1.5} /> Editar
                  </TextButton>
                  <TextButton onClick={() => run(() => setMilestoneStatus(m.id, "archived"))} disabled={pending}>
                    <Archive size={14} strokeWidth={1.5} /> Arquivar
                  </TextButton>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-sm text-text-1 transition-[color,transform] duration-150 hover:text-volt active:scale-90 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function TextButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-text-2 transition-[color,background-color,transform] duration-150 hover:bg-white/[0.05] hover:text-text-0 active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
