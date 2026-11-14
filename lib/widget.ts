/**
 * Payload do widget do iPhone (ARCHITECTURE §9): só números prontos, sem nada que o Scriptable
 * precise calcular. Dinheiro em centavos (inteiros). Puro, testável.
 */
import type { PaceResult } from "@/lib/metrics/pace";

export interface WidgetPayload {
  milestone_title: string | null;
  current_cents: number;
  target_cents: number;
  /** 0..1+ (pode passar de 1 quando bate). */
  pct: number;
  remaining_cents: number;
  pace_needed_cents: number;
  /** Onde deveria estar hoje (0..1), para a marca na barra. */
  expected_pct: number;
  on_track: boolean;
  achieved: boolean;
  /** Dias úteis restantes no período do marco. */
  bd_left: number;
  score_today: number;
  /** Pipeline chega na Fase 3: até lá, null. */
  outreach_today: number | null;
  outreach_goal: number | null;
  focus_minutes: number;
  focus_goal_minutes: number;
  habits_done: number;
  habits_expected: number;
  /** ISO do momento em que os números foram calculados. */
  updated_at: string;
}

export function buildWidgetPayload(
  highlight: { milestone: { title: string }; pace: PaceResult } | null,
  today: {
    score: { score: number };
    focusMinutes: number;
    focusGoalMinutes: number;
    habitsDone: number;
    habitsExpected: number;
  },
  now: Date,
): WidgetPayload {
  const p = highlight?.pace;
  return {
    milestone_title: highlight?.milestone.title ?? null,
    current_cents: p?.currentCents ?? 0,
    target_cents: p?.targetCents ?? 0,
    pct: p ? Math.round(p.pct * 1000) / 1000 : 0,
    remaining_cents: p?.remainingCents ?? 0,
    pace_needed_cents: p?.paceNeededCents ?? 0,
    expected_pct: p ? Math.round(p.expectedPct * 1000) / 1000 : 0,
    on_track: p?.onTrack ?? false,
    achieved: p?.achieved ?? false,
    bd_left: p?.bdLeft ?? 0,
    score_today: today.score.score,
    outreach_today: null,
    outreach_goal: null,
    focus_minutes: Math.round(today.focusMinutes),
    focus_goal_minutes: today.focusGoalMinutes,
    habits_done: today.habitsDone,
    habits_expected: today.habitsExpected,
    updated_at: now.toISOString(),
  };
}
