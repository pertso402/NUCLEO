"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PriorityPicker } from "@/components/ui/Priority";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/data/productivity";
import { PROJECT_COLOR_KEYS, PROJECT_COLORS, PROJECT_KINDS, type ProjectColor, type ProjectKind } from "@/lib/projects-palette";
import { createProject, setProjectStatus, updateProject } from "@/app/(app)/rotina/productivity-actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

/** Criar/editar projeto: nome, tipo, cor, meta de horas por semana, prazo e descrição. */
export function ProjectForm({
  project,
  suggestedColor,
  onDone,
}: {
  project?: Project;
  suggestedColor: ProjectColor;
  onDone: (id?: string) => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [kind, setKind] = useState<ProjectKind>(project?.kind ?? "negocio");
  const [color, setColor] = useState<ProjectColor>(project?.color ?? suggestedColor);
  const [hours, setHours] = useState(project?.weekly_hours_goal ? String(project.weekly_hours_goal) : "");
  const [deadline, setDeadline] = useState(project?.deadline ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [priority, setPriority] = useState(project?.priority ?? 2);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    const h = hours.trim() ? Number(hours.replace(",", ".")) : null;
    if (h !== null && (!Number.isFinite(h) || h <= 0 || h > 168)) {
      setError("Meta de horas entre 0,5 e 168.");
      return;
    }
    const input = { name, kind, color, weekly_hours_goal: h, deadline: deadline || null, description: description || null, priority };
    start(async () => {
      const r = project ? await updateProject(project.id, input) : await createProject(input);
      if (r.ok) onDone("id" in r && typeof r.id === "string" ? r.id : project?.id);
      else setError(r.error);
    });
  };

  const pill = (on: boolean) =>
    cn(
      "h-8 rounded-full border px-3 text-xs transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
      on ? "border-line-strong bg-white/[0.08] text-text-0" : "border-line text-text-2 hover:text-text-1",
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome (ex.: Choppatinhas, ARTe, Faculdade)"
        aria-label="Nome do projeto"
        maxLength={60}
        className={field}
        autoFocus={!project}
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
        {PROJECT_KINDS.map((k) => (
          <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)} className={pill(kind === k.value)}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor">
        {PROJECT_COLOR_KEYS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={PROJECT_COLORS[c].label}
            onClick={() => setColor(c)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-transform duration-150 active:scale-90",
              color === c && "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-bg-2",
            )}
            style={{ background: PROJECT_COLORS[c].hex }}
          >
            {color === c && <Check size={14} strokeWidth={3} className="text-bg-0" />}
          </button>
        ))}
      </div>
      <PriorityPicker value={priority} onChange={setPriority} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-2">
          Meta h/semana
          <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="ex.: 10" className={cn(field, "num")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-2">
          Prazo
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={cn(field, "num")} />
        </label>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        aria-label="Descrição"
        maxLength={280}
        rows={2}
        className={cn(field, "h-auto py-2")}
      />
      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {project ? "Salvar" : "Criar projeto"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => onDone()}>
          Cancelar
        </Button>
        {project && (
          <div className="ml-auto flex gap-1">
            {project.status === "active" ? (
              <button type="button" className={pill(false)} onClick={() => start(async () => void (await setProjectStatus(project.id, "paused")))}>
                Pausar
              </button>
            ) : (
              <button type="button" className={pill(false)} onClick={() => start(async () => void (await setProjectStatus(project.id, "active")))}>
                Reativar
              </button>
            )}
            {project.status !== "done" && (
              <button type="button" className={pill(false)} onClick={() => start(async () => void (await setProjectStatus(project.id, "done")))}>
                Concluir
              </button>
            )}
            <button
              type="button"
              className={cn(pill(false), "hover:text-flare")}
              onClick={() =>
                confirmArchive ? start(async () => void ((await setProjectStatus(project.id, "archived")).ok && onDone())) : setConfirmArchive(true)
              }
            >
              {confirmArchive ? "Confirmar arquivar" : "Arquivar"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
