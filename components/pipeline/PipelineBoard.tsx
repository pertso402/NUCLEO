"use client";

import { useMemo, useOptimistic, useState, useTransition, type DragEvent } from "react";
import { ArrowRight, CalendarClock, Plus } from "lucide-react";
import { Money } from "@/components/hud/Money";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import type { Lead } from "@/lib/data/pipeline";
import {
  buildColumns,
  isOverdue,
  isStaleProposal,
  LOST_REASONS,
  nextStage,
  STAGE_LABEL,
  type LeadStage,
} from "@/lib/metrics/pipeline";
import { moveLead } from "@/app/(app)/pipeline/actions";
import { LeadSheet } from "./LeadSheet";

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function dueText(d: string, today: string): string {
  if (d === today) return "hoje";
  if (d === addDays(today, 1)) return "amanhã";
  if (d === addDays(today, -1)) return "ontem";
  return `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

type Move = { id: string; stage: LeadStage };

/**
 * Pipeline (ARCHITECTURE §7.6): kanban por etapa. Desktop: arrastar o card entre colunas.
 * Mobile: abas por etapa e "Avançar" no card. Toque no card abre o detalhe.
 */
export function PipelineBoard({ leads, today, nowIso }: { leads: Lead[]; today: string; nowIso: string }) {
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<LeadStage>(() => {
    const firstWithItems = (["abordado", "conversou", "reuniao", "proposta"] as LeadStage[]).find((s) =>
      leads.some((l) => l.stage === s),
    );
    return firstWithItems ?? "abordado";
  });
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  const [askLost, setAskLost] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);

  const [optimistic, apply] = useOptimistic(leads, (s, m: Move) => s.map((l) => (l.id === m.id ? { ...l, stage: m.stage } : l)));
  const columns = useMemo(() => buildColumns(optimistic), [optimistic]);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const open = openId && openId !== "new" ? optimistic.find((l) => l.id === openId) ?? null : null;

  function move(id: string, stage: LeadStage, lostReason?: string) {
    const lead = optimistic.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    if (stage === "perdido" && !lostReason) {
      setAskLost(id);
      return;
    }
    setError(null);
    start(async () => {
      apply({ id, stage });
      const r = await moveLead(id, stage, { lost_reason: lostReason ?? null });
      if (!r.ok) setError(r.error);
    });
  }

  const onDrop = (stage: LeadStage) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/lead-id");
    if (id) move(id, stage);
  };

  const card = (l: Lead) => (
    <LeadCard key={l.id} lead={l} today={today} now={now} onOpen={() => setOpenId(l.id)} onAdvance={(s) => move(l.id, s)} />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="num text-xs text-text-2">
          {optimistic.filter((l) => l.stage !== "fechado" && l.stage !== "perdido").length} vivos
          {" · "}
          <span className={optimistic.some((l) => isOverdue(l, today)) ? "text-ember" : undefined}>
            {optimistic.filter((l) => isOverdue(l, today)).length} atrasados
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpenId("new")}
          className="flex h-9 items-center gap-1.5 rounded-full border border-ion/50 bg-ion/10 px-3.5 text-sm text-ion shadow-[0_0_12px_rgba(46,230,255,0.15)] transition-[box-shadow,transform] duration-150 hover:shadow-glow-ion active:scale-95"
        >
          <Plus size={16} strokeWidth={2} /> Novo lead
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      {/* Mobile: abas por etapa */}
      <div className="lg:hidden">
        <div role="tablist" aria-label="Etapas" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {columns.map((c) => {
            const on = c.stage === mobileStage;
            const late = c.items.some((l) => isOverdue(l, today));
            return (
              <button
                key={c.stage}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setMobileStage(c.stage)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                  on ? "border-ion/50 bg-ion/10 text-ion" : "border-line text-text-2",
                )}
              >
                {c.label}
                <span className={cn("num text-xs", late ? "text-ember" : on ? "text-ion" : "text-text-2")}>{c.count}</span>
              </button>
            );
          })}
        </div>
        {(() => {
          const col = columns.find((c) => c.stage === mobileStage)!;
          return (
            <section className="mt-3 flex flex-col gap-2" aria-label={col.label}>
              {col.monthlyCents > 0 && (
                <p className="num px-1 text-xs text-text-2">
                  <Money cents={col.monthlyCents} showCents={false} className="text-xs" />/mês em {col.label.toLowerCase()}
                </p>
              )}
              {col.items.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">
                  Ninguém em {col.label.toLowerCase()}.
                </p>
              ) : (
                col.items.map(card)
              )}
            </section>
          );
        })()}
      </div>

      {/* Desktop: kanban */}
      <div className="hidden gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-6">
        {columns.map((c) => (
          <section
            key={c.stage}
            aria-label={c.label}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(c.stage);
            }}
            onDragLeave={() => setDragOver((s) => (s === c.stage ? null : s))}
            onDrop={onDrop(c.stage)}
            className={cn(
              "flex min-h-64 min-w-48 flex-col gap-2 rounded-md border p-2 transition-[border-color,background-color] duration-150",
              dragOver === c.stage ? "border-ion/60 bg-ion/5" : "border-line bg-bg-1/60",
            )}
          >
            <header className="flex items-baseline justify-between gap-1 px-1 pt-1">
              <h2 className={cn("label-instrument", c.stage === "fechado" ? "text-volt" : c.stage === "perdido" ? "" : "text-ion")}>
                {c.label}
              </h2>
              <span className="num text-xs text-text-2">{c.count}</span>
            </header>
            {c.monthlyCents > 0 && (
              <p className="num px-1 text-[11px] text-text-2">
                <Money cents={c.monthlyCents} showCents={false} className="text-[11px]" />
                /mês
              </p>
            )}
            {c.items.map(card)}
          </section>
        ))}
      </div>

      {askLost && (
        <LostReasonDialog
          onPick={(reason) => {
            const id = askLost;
            setAskLost(null);
            move(id, "perdido", reason);
          }}
          onCancel={() => setAskLost(null)}
        />
      )}

      {(open || openId === "new") && (
        <LeadSheet
          key={openId ?? "x"}
          lead={open}
          today={today}
          onClose={() => setOpenId(null)}
          onMove={(stage, reason) => (open ? move(open.id, stage, reason) : undefined)}
        />
      )}
    </div>
  );
}

function LeadCard({
  lead,
  today,
  now,
  onOpen,
  onAdvance,
}: {
  lead: Lead;
  today: string;
  now: Date;
  onOpen: () => void;
  onAdvance: (s: LeadStage) => void;
}) {
  const late = isOverdue(lead, today);
  const stale = isStaleProposal(lead, now);
  const next = nextStage(lead.stage);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lead-id", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "edge-light group rounded-md border bg-bg-2/90 p-3 transition-[border-color,transform] duration-150 lg:cursor-grab lg:active:cursor-grabbing",
        late ? "border-ember/50" : "border-line hover:border-line-strong",
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <p className="truncate text-sm font-medium text-text-0">{lead.name}</p>
        {lead.business && <p className="truncate text-xs text-text-2">{lead.business}</p>}
        {lead.next_action && (
          <p className={cn("mt-2 flex items-start gap-1.5 text-xs", late ? "text-ember" : "text-text-1")}>
            <CalendarClock size={13} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />
            <span className="min-w-0">
              {lead.next_action}
              {lead.next_action_on && <span className="num"> · {late ? "atrasado · " : ""}{dueText(lead.next_action_on, today)}</span>}
            </span>
          </p>
        )}
        {stale && <p className="mt-1 text-xs text-ember">Proposta parada há 7+ dias: faça follow-up.</p>}
        {lead.monthly_value_cents !== null && (
          <p className="mt-1.5 text-xs text-text-2">
            <Money cents={lead.monthly_value_cents} showCents={false} tone={lead.stage === "fechado" ? "volt" : "default"} className="text-xs" />
            /mês
          </p>
        )}
      </button>
      {next && (
        <button
          type="button"
          onClick={() => onAdvance(next)}
          className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-sm border border-line text-xs text-text-1 transition-[color,border-color,transform] duration-150 hover:border-ion/50 hover:text-ion active:scale-[0.97] lg:hidden lg:group-hover:flex"
        >
          Avançar <ArrowRight size={13} strokeWidth={1.5} /> {STAGE_LABEL[next]}
        </button>
      )}
    </article>
  );
}

export function LostReasonDialog({ onPick, onCancel }: { onPick: (reason: string) => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Motivo da perda" className="fixed inset-0 z-[60] flex items-end justify-center bg-bg-0/80 p-4 sm:items-center">
      <div className="edge-light w-full max-w-sm bg-glass-strong rounded-lg border border-line-strong p-4">
        <p className="mb-3 text-sm text-text-0">Por que não fechou?</p>
        <div className="grid grid-cols-2 gap-2">
          {LOST_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onPick(r.value)}
              className="h-11 rounded-sm border border-line text-sm text-text-1 transition-[border-color,color,transform] duration-150 hover:border-flare/50 hover:text-text-0 active:scale-95"
            >
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="mt-3 h-10 w-full text-sm text-text-2 hover:text-text-0">
          Cancelar
        </button>
      </div>
    </div>
  );
}
