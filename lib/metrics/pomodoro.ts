/**
 * Ciclo do pomodoro (puro, testável): foco → pausa curta → foco … → pausa longa a cada N focos.
 * Só o foco vira registro de tempo; as pausas não contam como trabalho.
 */
export type PomodoroPhase = "focus" | "short_break" | "long_break";

export interface PomodoroConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Focos até a pausa longa. */
  cycles: number;
}

export const DEFAULT_POMODORO: PomodoroConfig = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cycles: 4 };

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: "Foco",
  short_break: "Pausa curta",
  long_break: "Pausa longa",
};

export function phaseMinutes(phase: PomodoroPhase, cfg: PomodoroConfig): number {
  return phase === "focus" ? cfg.focusMinutes : phase === "short_break" ? cfg.shortBreakMinutes : cfg.longBreakMinutes;
}

/**
 * Próxima fase. `focusDone` = quantos focos já foram concluídos (contando o que acabou agora, se era foco).
 */
export function nextPhase(current: PomodoroPhase, focusDone: number, cfg: PomodoroConfig): PomodoroPhase {
  if (current !== "focus") return "focus";
  return focusDone > 0 && focusDone % cfg.cycles === 0 ? "long_break" : "short_break";
}

/** Posição no ciclo atual (1..cycles) para mostrar "foco 2 de 4". */
export function cyclePosition(focusDone: number, cfg: PomodoroConfig): number {
  return (focusDone % cfg.cycles) + 1;
}

/** "24:59" / "1:02:03". */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
