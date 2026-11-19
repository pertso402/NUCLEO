"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Pencil, Play } from "lucide-react";
import { useFocusMaybe } from "@/components/focus/FocusProvider";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/data/productivity";
import { PROJECT_KIND_LABEL, projectHex } from "@/lib/projects-palette";
import { ProjectForm } from "./ProjectForm";

const STATUS_LABEL = { active: "Ativo", paused: "Pausado", done: "Concluído", archived: "Arquivado" } as const;

/** Cabeçalho do projeto: cor, nome, tipo/status, focar agora e editar. */
export function ProjectHeader({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const focus = useFocusMaybe();
  const hex = projectHex(project.color);
  const running = focus && (focus.view.mode === "timer" || focus.view.mode === "pomodoro") && focus.view.entry.project_id === project.id;

  return (
    <header className="mb-5 flex flex-col gap-4">
      <Link href="/rotina?aba=projetos" className="flex w-fit items-center gap-1 text-sm text-text-2 hover:text-text-0">
        <ChevronLeft size={16} strokeWidth={1.75} /> Projetos
      </Link>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-md font-display text-lg"
          style={{ background: `${hex}22`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}66, 0 0 18px ${hex}33` }}
        >
          {project.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-display text-xl text-text-0">{project.name}</h1>
          <p className="text-sm text-text-2">
            {PROJECT_KIND_LABEL[project.kind]} · {STATUS_LABEL[project.status]}
            {project.weekly_hours_goal ? ` · meta ${String(project.weekly_hours_goal).replace(".", ",")}h/semana` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          aria-label="Editar projeto"
          aria-expanded={editing}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
        >
          <Pencil size={16} strokeWidth={1.5} />
        </button>
      </div>
      {project.description && <p className="text-sm text-text-1">{project.description}</p>}
      {focus && !running && project.status === "active" && (
        <button
          type="button"
          onClick={() => focus.start({ kind: "pomodoro", project_id: project.id, label: null })}
          disabled={focus.pending}
          className={cn(
            "flex h-10 w-fit items-center gap-2 rounded-full bg-plasma/15 px-4 text-sm text-text-0 shadow-[inset_0_0_0_1px_rgba(124,92,255,0.5)] transition-transform duration-150 active:scale-95",
          )}
        >
          <Play size={15} strokeWidth={2} className="text-plasma" /> Pomodoro neste projeto
        </button>
      )}
      {editing && (
        <section className="glass edge-light rounded-md border border-line p-4">
          <ProjectForm project={project} suggestedColor={project.color} onDone={() => setEditing(false)} />
        </section>
      )}
    </header>
  );
}
