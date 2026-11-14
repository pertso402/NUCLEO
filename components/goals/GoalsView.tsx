"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import type { Goal } from "@/lib/data/goals";
import { AREAS, addQuarters, quarterElapsed, quarterLabel } from "@/lib/metrics/goals";
import { GoalCard } from "./GoalCard";
import { GoalForm } from "./GoalForm";

/**
 * Objetivos do trimestre (ARCHITECTURE §7.4): agrupados por área, com o porquê, a métrica
 * contra o tempo do trimestre e as tarefas vinculadas. Concluídos e deixados de lado ficam embaixo.
 */
export function GoalsView({
  goals,
  quarter,
  currentQuarter,
  today,
  base = "/objetivos",
}: {
  goals: Goal[];
  quarter: string;
  currentQuarter: string;
  today: string;
  base?: string;
}) {
  const [creating, setCreating] = useState(goals.length === 0);
  const elapsed = quarterElapsed(quarter, today);
  const quarters = [addQuarters(currentQuarter, -1), currentQuarter, addQuarters(currentQuarter, 1), addQuarters(currentQuarter, 2)];
  const href = (q: string) => (q === currentQuarter ? base : `${base}?tri=${q}`);

  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "done");
  const dropped = goals.filter((g) => g.status === "dropped");
  const byArea = AREAS.map((a) => ({ ...a, goals: active.filter((g) => g.area === a.value) })).filter((a) => a.goals.length);

  const isPast = quarter < currentQuarter;
  const isFuture = quarter > currentQuarter;

  return (
    <div className="flex flex-col gap-5">
      <HudCard accent="plasma">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={href(addQuarters(quarter, -1))}
            scroll={false}
            aria-label="Trimestre anterior"
            className="flex size-9 items-center justify-center rounded-full text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </Link>
          <div className="text-center">
            <p className="font-display text-base font-semibold text-text-0">{quarterLabel(quarter)}</p>
            <p className="num text-xs text-text-2">
              {isPast ? "trimestre encerrado" : isFuture ? "ainda não começou" : `dia ${elapsed.day} de ${elapsed.total}`}
              {quarter !== currentQuarter && (
                <>
                  {" · "}
                  <Link href={base} scroll={false} className="text-plasma hover:underline">
                    voltar ao atual
                  </Link>
                </>
              )}
            </p>
          </div>
          <Link
            href={href(addQuarters(quarter, 1))}
            scroll={false}
            aria-label="Próximo trimestre"
            className="flex size-9 items-center justify-center rounded-full text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </Link>
        </div>
        {!isPast && !isFuture && (
          <div className="mt-3 h-1 rounded-full bg-white/[0.06]">
            <div className="h-full origin-left rounded-full bg-text-2" style={{ transform: `scaleX(${elapsed.pct})` }} />
          </div>
        )}
      </HudCard>

      <div className="flex items-center justify-between gap-2">
        <h2 className="label-instrument">
          Em andamento <span className="num">· {active.length}</span>
        </h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-plasma/50 bg-plasma/15 px-3.5 text-sm text-text-0 shadow-[0_0_12px_rgba(124,92,255,0.2)] transition-[box-shadow,transform] duration-150 hover:shadow-glow-plasma active:scale-95"
          >
            <Plus size={16} strokeWidth={2} /> Novo objetivo
          </button>
        )}
      </div>

      {creating && (
        <section className="glass edge-light rounded-md border border-plasma/40 p-4 lg:max-w-2xl">
          <GoalForm quarter={quarter} quarters={quarters} onDone={() => setCreating(false)} />
        </section>
      )}

      {active.length === 0 && !creating && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">
          Nenhum objetivo em andamento neste trimestre.
        </p>
      )}

      {byArea.map((a) => (
        <section key={a.value} aria-label={a.label}>
          <h3 className="label-instrument mb-2">{a.label}</h3>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {a.goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                elapsed={isPast ? 1 : isFuture ? 0 : elapsed.pct}
                quarter={quarter}
                quarters={quarters}
                showArea={false}
              />
            ))}
          </ul>
        </section>
      ))}

      {[
        { title: "Concluídos", list: done },
        { title: "Deixados de lado", list: dropped },
      ].map(
        (s) =>
          s.list.length > 0 && (
            <details key={s.title} className="group rounded-md border border-line bg-bg-2/60 px-4 py-3" open={s.title === "Concluídos"}>
              <summary className="label-instrument cursor-pointer list-none select-none">
                {s.title} ({s.list.length})
              </summary>
              <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {s.list.map((g) => (
                  <GoalCard key={g.id} goal={g} elapsed={elapsed.pct} quarter={quarter} quarters={quarters} />
                ))}
              </ul>
            </details>
          ),
      )}
    </div>
  );
}
