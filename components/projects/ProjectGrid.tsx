"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CheckCircle2, ListTodo, Plus } from "lucide-react";
import { PriorityChip } from "@/components/ui/Priority";
import { cn } from "@/lib/cn";
import { addDays, type ISODate } from "@/lib/dates";
import type { ProjectStats } from "@/lib/data/productivity";
import { fmtHours } from "@/lib/metrics/time";
import { nextFreeColor, PROJECT_KIND_LABEL, projectHex } from "@/lib/projects-palette";
import { ProjectForm } from "./ProjectForm";

const STATUS_LABEL = { active: "Ativo", paused: "Pausado", done: "Concluído", archived: "Arquivado" } as const;

function ago(iso: string | null, today: ISODate): string {
  if (!iso) return "sem atividade";
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  if (d === today) return "ativo hoje";
  if (d === addDays(today, -1)) return "ativo ontem";
  const days = Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000);
  return `há ${days} dias`;
}

/** Projetos e negócios em cards: horas da semana × meta, tarefas e última atividade. */
export function ProjectGrid({ projects, today }: { projects: ProjectStats[]; today: ISODate }) {
  const [creating, setCreating] = useState(projects.length === 0);
  const active = projects.filter((p) => p.status === "active");
  const others = projects.filter((p) => p.status !== "active");
  const totalWeek = active.reduce((s, p) => s + p.minutesWeek, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm text-text-1">
          {active.length} {active.length === 1 ? "projeto ativo" : "projetos ativos"} · <span className="num text-text-0">{fmtHours(totalWeek)}</span> nesta semana
        </p>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-volt/40 bg-volt/10 px-3.5 text-sm text-volt transition-transform duration-150 active:scale-95"
          >
            <Plus size={16} strokeWidth={2} /> Novo
          </button>
        )}
      </div>

      {creating && (
        <section className="glass edge-light rounded-md border border-volt/30 p-4">
          <h3 className="label-instrument mb-3">Novo projeto ou negócio</h3>
          <ProjectForm suggestedColor={nextFreeColor(projects.map((p) => p.color))} onDone={() => setCreating(false)} />
        </section>
      )}

      {projects.length === 0 && !creating && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">
          Crie seus projetos e negócios para separar tarefas e horas.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((p) => (
          <ProjectCard key={p.id} p={p} today={today} />
        ))}
      </ul>

      {others.length > 0 && (
        <section>
          <h3 className="label-instrument mb-2">Pausados e concluídos</h3>
          <ul className="grid grid-cols-1 gap-3 opacity-75 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((p) => (
              <ProjectCard key={p.id} p={p} today={today} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ProjectCard({ p, today }: { p: ProjectStats; today: ISODate }) {
  const hex = projectHex(p.color);
  const goalMin = p.weekly_hours_goal ? p.weekly_hours_goal * 60 : null;
  const pct = goalMin ? Math.min(1, p.minutesWeek / goalMin) : null;
  const total = p.openTasks + p.doneTasks;
  const daysLeft = p.deadline ? Math.round((Date.parse(p.deadline) - Date.parse(today)) / 86_400_000) : null;

  return (
    <li>
      <Link
        href={`/rotina/projeto/${p.id}`}
        prefetch
        className="edge-light group relative flex h-full flex-col gap-3 overflow-hidden rounded-md border border-line bg-bg-2/80 p-4 transition-[border-color,transform] duration-150 hover:border-line-strong active:scale-[0.98]"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: hex, boxShadow: `0 0 12px ${hex}` }} />
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-sm font-display text-base"
            style={{ background: `${hex}22`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}55` }}
          >
            {p.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-base font-semibold text-text-0">{p.name}</span>
              <PriorityChip value={p.priority} hideMedium />
            </span>
            <span className="text-xs text-text-2">
              {PROJECT_KIND_LABEL[p.kind]}
              {p.status !== "active" && ` · ${STATUS_LABEL[p.status]}`} · {ago(p.lastActivity, today)}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-text-2">Semana</span>
            <span className="num text-text-1">
              <span className="text-base text-text-0">{fmtHours(p.minutesWeek)}</span>
              {goalMin ? ` / ${fmtHours(goalMin)}` : ""}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full origin-left rounded-full transition-transform duration-500"
              style={{ background: hex, transform: `scaleX(${pct ?? (p.minutesWeek > 0 ? 1 : 0)})`, opacity: pct === null ? 0.35 : 1 }}
            />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
          <span className="flex items-center gap-1">
            <ListTodo size={13} strokeWidth={1.5} aria-hidden />
            <span className="num text-text-1">{p.openTasks}</span> abertas
          </span>
          {total > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} strokeWidth={1.5} aria-hidden />
              <span className="num text-text-1">{Math.round((p.doneTasks / total) * 100)}%</span>
            </span>
          )}
          <span className="num">{fmtHours(p.minutesMonth)} no mês</span>
          {daysLeft !== null && (
            <span className={cn("flex items-center gap-1", daysLeft < 0 ? "text-flare" : daysLeft <= 7 ? "text-ember" : "")}>
              <CalendarClock size={13} strokeWidth={1.5} aria-hidden />
              {daysLeft < 0 ? `${-daysLeft}d atrasado` : daysLeft === 0 ? "prazo hoje" : `${daysLeft}d`}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
