"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Coffee, Play, Square, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, PHASE_LABEL } from "@/lib/metrics/pomodoro";
import { projectHex } from "@/lib/projects-palette";
import { useFocus } from "./FocusProvider";

/**
 * Pílula flutuante do foco: aparece em qualquer tela enquanto há timer, pomodoro ou pausa.
 * Toque leva à aba Foco; o botão ao lado para (ou começa o próximo foco quando a pausa acaba).
 * Some na própria aba Foco (lá o relógio grande já está na tela).
 */
export function FocusPill() {
  const f = useFocus();
  const path = usePathname();
  const params = useSearchParams();
  const onFocusTab = path === "/rotina" && params.get("aba") === "foco";
  const v = f.view;
  if (v.mode === "idle" || onFocusTab) return null;

  const isBreak = v.mode === "break";
  const entry = v.mode === "break" ? null : v.entry;
  const project = f.projectOf(entry?.project_id ?? (isBreak ? v.next.project_id : null));
  const clock = v.mode === "timer" ? formatClock(v.elapsedMs) : formatClock(v.remainingMs);
  const progress = v.mode === "timer" ? null : 1 - v.remainingMs / v.totalMs;
  const title = isBreak ? (v.over ? "Pausa acabou" : PHASE_LABEL[v.phase]) : entry?.label || project?.name || (v.mode === "pomodoro" ? "Pomodoro" : "Foco livre");

  return (
    <div
      className="fixed left-4 z-40 flex max-w-[calc(100vw-7.5rem)] items-center gap-1 lg:right-6 lg:bottom-6! lg:left-auto lg:max-w-sm"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
    >
      <Link
        href="/rotina?aba=foco"
        prefetch
        className={cn(
          "glass relative flex h-12 min-w-0 items-center gap-2.5 overflow-hidden rounded-full border py-1 pr-4 pl-1.5 transition-transform duration-150 active:scale-95",
          isBreak ? "border-ion/40" : "border-plasma/50 shadow-glow-plasma",
        )}
        aria-label={`${title}: ${clock}. Abrir foco`}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            isBreak ? "bg-ion/15 text-ion" : "bg-plasma/20 text-plasma",
          )}
        >
          {isBreak ? <Coffee size={17} strokeWidth={1.75} /> : <Timer size={17} strokeWidth={1.75} className={cn(!f.pending && "animate-pulse")} />}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn("num text-base font-semibold tabular-nums", isBreak && v.over ? "text-ion" : "text-text-0")}>
            {isBreak && v.over ? "00:00" : clock}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-1">
            {project && <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: projectHex(project.color) }} />}
            <span className="truncate">{title}</span>
          </span>
        </span>
        {progress !== null && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
            <span
              className={cn("block h-full origin-left transition-transform duration-1000 ease-linear", isBreak ? "bg-ion" : "bg-plasma")}
              style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
            />
          </span>
        )}
      </Link>
      {isBreak && v.over ? (
        <button
          type="button"
          onClick={f.skipBreak}
          disabled={f.pending}
          aria-label="Começar o próximo foco"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-plasma text-text-0 shadow-glow-plasma transition-transform duration-150 active:scale-90"
        >
          <Play size={18} strokeWidth={2} />
        </button>
      ) : (
        <button
          type="button"
          onClick={f.stop}
          disabled={f.pending}
          aria-label={isBreak ? "Encerrar a pausa" : "Parar o foco"}
          className="glass flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-text-1 transition-[color,transform] duration-150 hover:text-flare active:scale-90"
        >
          <Square size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
