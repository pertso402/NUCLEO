"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import type { OpenFocus, Project } from "@/lib/data/productivity";
import { formatClock, nextPhase, phaseMinutes, PHASE_LABEL, type PomodoroConfig, type PomodoroPhase } from "@/lib/metrics/pomodoro";
import { finishPomodoro, startFocus, stopFocus, type FocusInput } from "@/app/(app)/rotina/productivity-actions";

/**
 * Foco global (Fase P): o timer/pomodoro roda em qualquer tela.
 * - A sessão de foco aberta vive no banco (`time_entries` sem `ended_at`) — sobrevive a recarregar e a trocar de aparelho.
 * - A pausa do pomodoro não é trabalho: fica só neste aparelho (localStorage).
 * - Fim de fase: notificação (se permitida), bipe e vibração.
 */

export interface FocusServerState {
  open: OpenFocus | null;
  config: PomodoroConfig;
  todayMinutes: number;
  todayPomodoros: number;
  focusGoalMinutes: number;
  projects: Project[];
  /** "Agora" do servidor (ms): o relógio começa daqui para o HTML do servidor e o do cliente baterem. */
  serverNow: number;
}

interface BreakState {
  phase: Exclude<PomodoroPhase, "focus">;
  endsAt: number;
  /** Para o próximo foco continuar na mesma tarefa/projeto. */
  next: Pick<FocusInput, "task_id" | "project_id" | "label">;
}

export type FocusView =
  | { mode: "idle" }
  | { mode: "timer"; elapsedMs: number; entry: OpenFocus }
  | { mode: "pomodoro"; remainingMs: number; totalMs: number; entry: OpenFocus }
  | { mode: "break"; phase: BreakState["phase"]; remainingMs: number; totalMs: number; over: boolean; next: BreakState["next"] };

interface FocusContextValue extends FocusServerState {
  now: number;
  view: FocusView;
  pending: boolean;
  error: string | null;
  /** Posição no ciclo para "foco 2 de 4" (conta o pomodoro em andamento). */
  cycle: number;
  start: (input: FocusInput) => void;
  stop: () => void;
  skipBreak: () => void;
  projectOf: (id: string | null | undefined) => Project | null;
}

const Ctx = createContext<FocusContextValue | null>(null);
const BREAK_KEY = "nucleo:pomodoro-break";

// A pausa fica no localStorage, lida via useSyncExternalStore (sincroniza entre abas pelo evento "storage").
const breakListeners = new Set<() => void>();
function subscribeBreak(cb: () => void) {
  breakListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    breakListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function rawBreak(): string {
  try {
    return localStorage.getItem(BREAK_KEY) ?? "";
  } catch {
    return "";
  }
}
function parseBreak(raw: string): BreakState | null {
  try {
    return raw ? (JSON.parse(raw) as BreakState) : null;
  } catch {
    return null;
  }
}
function writeBreak(b: BreakState | null) {
  try {
    if (b) localStorage.setItem(BREAK_KEY, JSON.stringify(b));
    else localStorage.removeItem(BREAK_KEY);
  } catch {
    /* modo privado: a pausa só não sobrevive ao recarregar */
  }
  breakListeners.forEach((l) => l());
}

/** Bipe curto (Web Audio) + vibração. Silencioso se o navegador bloquear. */
function chime(times = 2) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      const ac = new AC();
      for (let i = 0; i < times; i++) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "sine";
        o.frequency.value = i % 2 ? 660 : 880;
        const t = ac.currentTime + i * 0.28;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + 0.25);
      }
      setTimeout(() => void ac.close(), times * 300 + 200);
    }
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    /* sem som */
  }
}

function notify(title: string, body: string) {
  chime();
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icons/icon-192.png", tag: "nucleo-foco" });
    }
  } catch {
    /* iOS fora do PWA não tem Notification */
  }
}

function askNotificationPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  } catch {
    /* ok */
  }
}

export function FocusProvider({ state, children }: { state: FocusServerState; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rawBrk = useSyncExternalStore(subscribeBreak, rawBreak, () => "");
  const brk = useMemo(() => parseBreak(rawBrk), [rawBrk]);
  const [now, setNow] = useState(state.serverNow);
  const finishing = useRef<string | null>(null);
  const breakNotified = useRef<number | null>(null);

  // Otimista: começar/parar reflete na hora; o servidor confirma via revalidate.
  const [open, setOpen] = useOptimistic(state.open);

  const cfg = state.config;
  const projectOf = useCallback((id: string | null | undefined) => state.projects.find((p) => p.id === id) ?? null, [state.projects]);
  const setBreak = writeBreak;

  /**
   * Transições de fase, chamadas a cada segundo pelo relógio:
   * - pomodoro chegou ao fim → fecha no banco no tempo planejado e começa a pausa;
   * - pausa acabou → avisa uma vez; a pausa "acabada" some sozinha depois de 30 min.
   * Só avisa se acabou agora (não quando o app reabre horas depois).
   */
  const onTick = useRef<(t: number) => void>(() => {});
  useEffect(() => {
    onTick.current = (t) => {
      if (open && open.kind === "pomodoro" && open.planned_minutes && open.id !== "optimistic") {
        const end = new Date(open.started_at).getTime() + open.planned_minutes * 60_000;
        if (t >= end && finishing.current !== open.id) {
          finishing.current = open.id;
          const phase = nextPhase("focus", state.todayPomodoros + 1, cfg) as BreakState["phase"];
          const b: BreakState = {
            phase,
            endsAt: end + phaseMinutes(phase, cfg) * 60_000,
            next: { task_id: open.task_id, project_id: open.project_id, label: open.label },
          };
          if (t - end < 120_000) notify("Pomodoro concluído", `${PHASE_LABEL[phase]} de ${phaseMinutes(phase, cfg)} min.`);
          if (b.endsAt > t - 30 * 60_000) setBreak(b);
          const entryId = open.id;
          startTransition(async () => {
            setOpen(null);
            const r = await finishPomodoro(entryId);
            if (!r.ok) setError(r.error);
          });
        }
      }
      if (brk) {
        if (t >= brk.endsAt && breakNotified.current !== brk.endsAt) {
          breakNotified.current = brk.endsAt;
          if (t - brk.endsAt < 120_000) notify("Pausa acabou", "Bora pro próximo foco.");
        }
        if (t > brk.endsAt + 30 * 60_000) setBreak(null);
      }
    };
  });

  const running = Boolean(open) || Boolean(brk);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      onTick.current(t);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running]);

  // Título da aba com o relógio (desktop).
  const view: FocusView = useMemo(() => {
    if (open) {
      const started = new Date(open.started_at).getTime();
      if (open.kind === "pomodoro" && open.planned_minutes) {
        const totalMs = open.planned_minutes * 60_000;
        return { mode: "pomodoro", remainingMs: Math.max(0, started + totalMs - now), totalMs, entry: open };
      }
      return { mode: "timer", elapsedMs: Math.max(0, now - started), entry: open };
    }
    if (brk) {
      const totalMs = phaseMinutes(brk.phase, cfg) * 60_000;
      return { mode: "break", phase: brk.phase, remainingMs: Math.max(0, brk.endsAt - now), totalMs, over: now >= brk.endsAt, next: brk.next };
    }
    return { mode: "idle" };
  }, [open, brk, now, cfg]);

  useEffect(() => {
    const base = document.title.replace(/^[\d:]+ · (Foco|Pausa) — /, "");
    if (view.mode === "idle" || (view.mode === "break" && view.over)) {
      document.title = base;
      return;
    }
    const clock = view.mode === "timer" ? formatClock(view.elapsedMs) : formatClock(view.remainingMs);
    document.title = `${clock} · ${view.mode === "break" ? "Pausa" : "Foco"} — ${base}`;
  }, [view]);

  const start = useCallback(
    (input: FocusInput) => {
      askNotificationPermission();
      setError(null);
      setBreak(null);
      finishing.current = null;
      startTransition(async () => {
        setOpen({
          id: "optimistic",
          label: input.label ?? null,
          started_at: new Date().toISOString(),
          kind: input.kind,
          planned_minutes: input.kind === "pomodoro" ? (input.planned_minutes ?? cfg.focusMinutes) : null,
          project_id: input.project_id ?? null,
          task_id: input.task_id ?? null,
        });
        const r = await startFocus({ ...input, planned_minutes: input.kind === "pomodoro" ? (input.planned_minutes ?? cfg.focusMinutes) : null });
        if (!r.ok) setError(r.error);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.focusMinutes],
  );

  const stop = useCallback(() => {
    setError(null);
    if (!open) {
      setBreak(null);
      return;
    }
    startTransition(async () => {
      setOpen(null);
      const r = await stopFocus();
      if (!r.ok) setError(r.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const skipBreak = useCallback(() => {
    const next = brk?.next ?? {};
    start({ kind: "pomodoro", ...next });
  }, [brk, start]);

  // todayPomodoros = pomodoros completos hoje (o que está rodando ainda não conta).
  const cycle = (state.todayPomodoros % cfg.cycles) + 1;

  const value: FocusContextValue = {
    ...state,
    open,
    now,
    view,
    pending,
    error,
    cycle,
    start,
    stop,
    skipBreak,
    projectOf,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFocus(): FocusContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFocus fora do FocusProvider");
  return v;
}

/** Versão que não quebra fora do provider (showcases /dev). */
export function useFocusMaybe(): FocusContextValue | null {
  return useContext(Ctx);
}
