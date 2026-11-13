"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Trash2, Trophy } from "lucide-react";
import { Money } from "@/components/hud/Money";
import type { MilestoneRow } from "@/lib/data/milestone";
import { METRIC_LABEL } from "@/lib/metrics/milestone-value";
import { deleteMilestone, setMilestoneStatus, type ActionResult } from "@/app/(app)/marcos/actions";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  };
  return { error, pending, run };
}

/**
 * Linha do tempo de conquistas (ARCHITECTURE §7.3): cada marco batido com a data e quanto tempo levou.
 * Gold aqui é permitido — é exatamente o contexto de conquista (DESIGN §6).
 */
export function AchievementTimeline({ items }: { items: (MilestoneRow & { days: number })[] }) {
  const { error, pending, run } = useAction();
  const [confirm, setConfirm] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-2">
        Nenhum marco batido ainda. O primeiro aparece aqui, em dourado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}
      <ol className="relative flex flex-col gap-5 pl-7">
        <span aria-hidden className="absolute top-2 bottom-2 left-[9px] w-px bg-linear-to-b from-gold/70 via-gold/25 to-transparent" />
        {items.map((m) => (
          <li key={m.id} className="relative">
            <span
              aria-hidden
              className="absolute top-0.5 -left-7 flex size-5 items-center justify-center rounded-full border border-gold/70 bg-bg-0 shadow-glow-gold"
            >
              <Trophy size={11} strokeWidth={2} className="text-gold" />
            </span>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="neon-gold truncate text-sm font-medium">{m.title}</p>
                <p className="num mt-0.5 text-xs text-text-2">
                  Batido em {dateFmt.format(new Date(m.achieved_at!))} · em {m.days} {m.days === 1 ? "dia" : "dias"}
                </p>
                <p className="mt-0.5 text-xs text-text-2">
                  {METRIC_LABEL[m.metric]} · <Money cents={m.target_cents} showCents={false} />
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => (confirm === m.id ? run(() => setMilestoneStatus(m.id, "active")) : setConfirm(m.id))}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs text-text-2 transition-[color,background-color,transform] duration-150 hover:bg-white/[0.05] hover:text-text-0 active:scale-95"
              >
                <RotateCcw size={13} strokeWidth={1.5} />
                {confirm === m.id ? "Confirmar" : "Reabrir"}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Marcos arquivados: voltar para a fila ou excluir de vez (com confirmação). */
export function ArchivedList({ items }: { items: MilestoneRow[] }) {
  const { error, pending, run } = useAction();
  const [confirm, setConfirm] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <details className="group rounded-md border border-line bg-bg-2/60 px-4 py-3">
      <summary className="label-instrument cursor-pointer list-none select-none">
        Arquivados ({items.length})
      </summary>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flare">
          {error}
        </p>
      )}
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm text-text-1">{m.title}</span>
              <span className="text-xs text-text-2">
                {METRIC_LABEL[m.metric]} · <Money cents={m.target_cents} showCents={false} />
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setMilestoneStatus(m.id, "active"))}
                className="h-8 rounded-full px-3 text-xs text-text-1 hover:bg-white/[0.05] hover:text-text-0 active:scale-95"
              >
                Voltar pra fila
              </button>
              <button
                type="button"
                disabled={pending}
                aria-label={confirm === m.id ? "Confirmar exclusão" : "Excluir"}
                onClick={() => (confirm === m.id ? run(() => deleteMilestone(m.id)) : setConfirm(m.id))}
                className="flex h-8 items-center gap-1 rounded-full px-3 text-xs text-text-2 hover:text-flare active:scale-95"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                {confirm === m.id && "Excluir de vez"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
