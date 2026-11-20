"use client";

import { ChevronDown, ChevronsUp, Flame, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITIES, priorityLabel, type Priority } from "@/lib/metrics/sequence";

/**
 * Prioridade (0 urgente/agora · 1 alta · 2 média · 3 baixa).
 * Só a urgente usa cor de sinal (Ember = atenção, DESIGN §2); as outras são neutras com ícone.
 */
const ICON = { 0: Flame, 1: ChevronsUp, 2: Minus, 3: ChevronDown } as const;
const TONE = {
  0: "border-ember/50 bg-ember/10 text-ember",
  1: "border-line-strong text-text-0",
  2: "border-line text-text-1",
  3: "border-line text-text-2",
} as const;

export function PriorityChip({
  value,
  kind = "group",
  hideMedium = false,
  className,
}: {
  value: number;
  kind?: "task" | "group";
  /** Esconde a média (padrão) para não poluir listas. */
  hideMedium?: boolean;
  className?: string;
}) {
  const p = (Math.min(3, Math.max(0, value)) as Priority) ?? 2;
  if (hideMedium && p === 2) return null;
  const Icon = ICON[p];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border px-1.5 text-xs leading-none", TONE[p], className)}>
      <Icon size={11} strokeWidth={2} aria-hidden />
      {priorityLabel(p, kind)}
    </span>
  );
}

/** Seletor de prioridade em pílulas. */
export function PriorityPicker({
  value,
  onChange,
  kind = "group",
  label = "Prioridade",
}: {
  value: number;
  onChange: (p: Priority) => void;
  kind?: "task" | "group";
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {PRIORITIES.map((p) => {
        const on = value === p.value;
        const Icon = ICON[p.value];
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex h-8 items-center gap-1 rounded-full border px-3 text-xs transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
              on ? (p.value === 0 ? "border-ember/60 bg-ember/15 text-ember" : "border-line-strong bg-white/[0.08] text-text-0") : "border-line text-text-2 hover:text-text-1",
            )}
          >
            <Icon size={12} strokeWidth={2} aria-hidden />
            {kind === "task" ? p.task : p.label}
          </button>
        );
      })}
    </div>
  );
}
