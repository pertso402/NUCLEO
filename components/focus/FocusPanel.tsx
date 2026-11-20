"use client";

import { useMemo, useState, useTransition } from "react";
import { Coffee, Pause, Play, Settings2, SkipForward, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ProjectArea, WorkTask } from "@/lib/data/productivity";
import { formatClock, PHASE_LABEL } from "@/lib/metrics/pomodoro";
import { doNow } from "@/lib/metrics/sequence";
import { fmtHours } from "@/lib/metrics/time";
import { projectHex } from "@/lib/projects-palette";
import { savePomodoroSettings } from "@/app/(app)/rotina/productivity-actions";
import { useFocus } from "./FocusProvider";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-plasma/60 focus:outline-none";

/** Aba Foco: relógio grande (pomodoro ou livre), no que focar, ciclo do dia e fila de tarefas. */
export function FocusPanel({ tasks, areas = [], focusGoalMinutes }: { tasks: WorkTask[]; areas?: ProjectArea[]; focusGoalMinutes: number }) {
  const f = useFocus();
  const v = f.view;
  const [mode, setMode] = useState<"pomodoro" | "timer">("pomodoro");
  const [taskId, setTaskId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const task = tasks.find((t) => t.id === taskId) ?? null;
  const effectiveProject = f.projectOf(task?.project_id ?? (projectId || null));

  const running = v.mode === "timer" || v.mode === "pomodoro";
  const entry = running ? v.entry : null;
  const runningProject = f.projectOf(entry?.project_id);
  const runningMin = v.mode === "timer" ? v.elapsedMs / 60_000 : v.mode === "pomodoro" ? (v.totalMs - v.remainingMs) / 60_000 : 0;
  // Do servidor vêm só as sessões fechadas de hoje; a aberta soma ao vivo.
  const todayMin = f.todayMinutes + runningMin;
  const goalPct = focusGoalMinutes > 0 ? Math.min(1, todayMin / focusGoalMinutes) : 0;

  // Fila: o "Fazer agora" (Agora, fazendo, próxima de cada sequência) e depois o resto por prioridade e prazo.
  const queue = useMemo(() => {
    const first = doNow(tasks, areas, f.projects.filter((p) => p.status === "active"), 6).map((x) => x.task);
    const rest = [...tasks]
      .filter((t) => !first.some((x) => x.id === t.id))
      .sort((a, b) => a.priority - b.priority || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
    return [...first, ...rest].slice(0, 6);
  }, [tasks, areas, f.projects]);

  const byProject = useMemo(() => {
    const groups = new Map<string, WorkTask[]>();
    for (const t of tasks) {
      const k = t.project_id ?? "";
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
  }, [tasks]);

  const startNow = (overrides?: { task?: WorkTask }) => {
    const t = overrides?.task ?? task;
    f.start({
      kind: mode,
      task_id: t?.id ?? null,
      project_id: t ? t.project_id : projectId || null,
      label: t ? t.title : label.trim() || null,
    });
  };

  // ---------------------------------------------------------------- relógio
  let clock = formatClock(f.config.focusMinutes * 60_000);
  let caption = mode === "pomodoro" ? `Pomodoro · foco ${f.cycle} de ${f.config.cycles}` : "Foco livre · cronômetro";
  let progress = 0;
  let tone: "plasma" | "ion" = "plasma";
  if (mode === "timer" && v.mode === "idle") clock = "00:00";
  if (v.mode === "pomodoro") {
    clock = formatClock(v.remainingMs);
    caption = `Foco ${f.cycle} de ${f.config.cycles}`;
    progress = 1 - v.remainingMs / v.totalMs;
  } else if (v.mode === "timer") {
    clock = formatClock(v.elapsedMs);
    caption = "Foco livre";
    progress = (v.elapsedMs % 3_600_000) / 3_600_000;
  } else if (v.mode === "break") {
    clock = v.over ? "00:00" : formatClock(v.remainingMs);
    caption = v.over ? "Pausa acabou — bora?" : PHASE_LABEL[v.phase];
    progress = 1 - v.remainingMs / v.totalMs;
    tone = "ion";
  }

  const R = 120;
  const C = 2 * Math.PI * R;
  const color = tone === "ion" ? "var(--ion)" : "var(--plasma)";

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <section aria-label="Relógio de foco" className="glass edge-light flex flex-col items-center gap-5 rounded-lg border border-line px-4 pt-5 pb-6">
        {v.mode === "idle" && (
          <div role="tablist" aria-label="Modo" className="flex rounded-full border border-line p-1">
            {(
              [
                ["pomodoro", "Pomodoro"],
                ["timer", "Livre"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-8 rounded-full px-4 text-sm transition-[background-color,color,transform] duration-150 active:scale-95",
                  mode === m ? "bg-plasma/20 text-text-0 shadow-[inset_0_0_0_1px_rgba(124,92,255,0.5)]" : "text-text-2 hover:text-text-1",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="relative aspect-square w-full max-w-[17rem]">
          <svg viewBox="0 0 280 280" className="size-full -rotate-90" aria-hidden>
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))}
              style={{ filter: `drop-shadow(0 0 8px ${tone === "ion" ? "rgba(46,230,255,0.55)" : "rgba(124,92,255,0.6)"})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
            {v.mode === "break" ? (
              <Coffee size={20} strokeWidth={1.5} className="text-ion" aria-hidden />
            ) : (
              <Timer size={20} strokeWidth={1.5} className={running ? "text-plasma" : "text-text-2"} aria-hidden />
            )}
            <span className={cn("num font-display leading-none text-text-0 tabular-nums neon-white", clock.length > 5 ? "text-2xl" : "text-3xl")} aria-live="off">
              {clock}
            </span>
            <span className="text-xs text-text-1">{caption}</span>
          </div>
        </div>

        {/* ciclo do pomodoro */}
        <div className="flex items-center gap-2" aria-label={`${f.todayPomodoros} pomodoros completos hoje`}>
          {Array.from({ length: f.config.cycles }, (_, i) => {
            const filled = i < f.todayPomodoros % f.config.cycles || (f.todayPomodoros > 0 && f.todayPomodoros % f.config.cycles === 0 && v.mode === "break");
            const current = v.mode === "pomodoro" && i === f.todayPomodoros % f.config.cycles;
            return (
              <span
                key={i}
                className={cn(
                  "size-2.5 rounded-full transition-[background-color,transform] duration-300 ring-1 ring-white/10",
                  filled ? "bg-plasma shadow-glow-plasma" : current ? "scale-125 bg-plasma/50" : "bg-white/10",
                )}
              />
            );
          })}
          <span className="num ml-1 text-xs text-text-2">{f.todayPomodoros} hoje</span>
        </div>

        {/* no que está focando */}
        {running && entry && (
          <div className="flex max-w-full items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">
            {runningProject && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: projectHex(runningProject.color) }} />}
            <span className="truncate text-text-0">{entry.label || runningProject?.name || "Sem descrição"}</span>
            {runningProject && entry.label && <span className="shrink-0 text-text-2">· {runningProject.name}</span>}
          </div>
        )}

        {/* ações */}
        <div className="flex w-full max-w-sm flex-col gap-2">
          {running ? (
            <Button variant="secondary" block onClick={f.stop} disabled={f.pending}>
              {v.mode === "pomodoro" ? <Pause size={16} strokeWidth={2} /> : <Square size={16} strokeWidth={2} />}
              {v.mode === "pomodoro" ? `Parar (registra ${fmtHours(runningMin)})` : "Parar e registrar"}
            </Button>
          ) : v.mode === "break" ? (
            <div className="flex gap-2">
              <Button variant="focus" block onClick={f.skipBreak} disabled={f.pending}>
                {v.over ? <Play size={16} strokeWidth={2} /> : <SkipForward size={16} strokeWidth={2} />}
                {v.over ? "Próximo foco" : "Pular pausa"}
              </Button>
              <Button variant="ghost" onClick={f.stop}>
                Encerrar
              </Button>
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor="focus-task">
                Tarefa
              </label>
              <select id="focus-task" value={taskId} onChange={(e) => setTaskId(e.target.value)} className={cn(field, "appearance-none")}>
                <option value="">Sem tarefa específica</option>
                {byProject.map(([pid, list]) => (
                  <optgroup key={pid || "none"} label={f.projectOf(pid)?.name ?? "Sem projeto"}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.status === "doing" ? "▶ " : ""}
                        {t.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {!task && (
                <div className="flex gap-2">
                  <select
                    aria-label="Projeto"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className={cn(field, "max-w-[45%] appearance-none")}
                  >
                    <option value="">Sem projeto</option>
                    {f.projects
                      .filter((p) => p.status === "active")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="No que vai focar?" aria-label="Descrição" maxLength={120} className={field} />
                </div>
              )}
              {effectiveProject && (
                <p className="flex items-center gap-1.5 text-xs text-text-1">
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: projectHex(effectiveProject.color) }} />
                  Conta para {effectiveProject.name}
                </p>
              )}
              <Button variant="focus" block onClick={() => startNow()} disabled={f.pending}>
                <Play size={16} strokeWidth={2} />
                {mode === "pomodoro" ? `Começar pomodoro de ${f.config.focusMinutes} min` : "Começar cronômetro"}
              </Button>
            </>
          )}
          {f.error && (
            <p role="alert" className="text-center text-sm text-flare">
              {f.error}
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {/* hoje */}
        <section aria-label="Foco de hoje" className="edge-light rounded-md border border-line bg-bg-2/80 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="label-instrument">Foco hoje</h3>
            <span className="num text-xs text-text-2">meta {fmtHours(focusGoalMinutes)}</span>
          </div>
          <p className="num mt-2 font-display text-2xl text-text-0">{fmtHours(todayMin)}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full origin-left rounded-full bg-plasma shadow-glow-plasma transition-transform duration-500"
              style={{ transform: `scaleX(${goalPct})` }}
            />
          </div>
          <p className="mt-2 text-xs text-text-2">
            {goalPct >= 1 ? "Meta do dia batida." : `Faltam ${fmtHours(focusGoalMinutes - todayMin)} para a meta.`}
          </p>
        </section>

        {/* fila */}
        {queue.length > 0 && v.mode !== "timer" && v.mode !== "pomodoro" && (
          <section aria-label="Fila de foco">
            <h3 className="label-instrument mb-2">Fila de foco</h3>
            <ul className="flex flex-col gap-1.5">
              {queue.map((t) => {
                const p = f.projectOf(t.project_id);
                return (
                  <li key={t.id} className="flex items-center gap-2 rounded-md border border-line bg-bg-2/80 py-1.5 pr-1.5 pl-3">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: projectHex(p?.color) }} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-text-0">{t.title}</span>
                      <span className="truncate text-xs text-text-2">
                        {p?.name ?? "Sem projeto"}
                        {t.trackedMinutes > 0 && ` · ${fmtHours(t.trackedMinutes)}`}
                        {t.estimate_minutes ? ` de ${fmtHours(t.estimate_minutes)}` : ""}
                        {t.status === "doing" && " · fazendo"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => startNow({ task: t })}
                      disabled={f.pending}
                      aria-label={`Focar em ${t.title}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plasma/15 text-plasma transition-[background-color,transform] duration-150 hover:bg-plasma/25 active:scale-90"
                    >
                      <Play size={15} strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* configurações */}
        <section className="rounded-md border border-line">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            aria-expanded={showSettings}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-1 hover:text-text-0"
          >
            <Settings2 size={15} strokeWidth={1.5} aria-hidden />
            Pomodoro: {f.config.focusMinutes}/{f.config.shortBreakMinutes}/{f.config.longBreakMinutes} min · {f.config.cycles} ciclos
          </button>
          {showSettings && <PomodoroSettings onDone={() => setShowSettings(false)} />}
        </section>
      </div>
    </div>
  );
}

function PomodoroSettings({ onDone }: { onDone: () => void }) {
  const { config } = useFocus();
  const [vals, setVals] = useState(config);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fields: { key: keyof typeof config; label: string; min: number; max: number }[] = [
    { key: "focusMinutes", label: "Foco (min)", min: 5, max: 120 },
    { key: "shortBreakMinutes", label: "Pausa curta", min: 1, max: 60 },
    { key: "longBreakMinutes", label: "Pausa longa", min: 1, max: 90 },
    { key: "cycles", label: "Ciclos", min: 2, max: 10 },
  ];
  return (
    <form
      className="flex flex-col gap-3 border-t border-line px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await savePomodoroSettings(vals);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        {fields.map((fd) => (
          <label key={fd.key} className="flex flex-col gap-1 text-xs text-text-2">
            {fd.label}
            <input
              type="number"
              inputMode="numeric"
              min={fd.min}
              max={fd.max}
              value={vals[fd.key]}
              onChange={(e) => setVals({ ...vals, [fd.key]: Number(e.target.value) })}
              className={cn(field, "num")}
            />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-flare">{error}</p>}
      <Button type="submit" variant="focus" disabled={pending}>
        Salvar
      </Button>
    </form>
  );
}
