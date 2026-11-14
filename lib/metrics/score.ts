/**
 * Score do dia (ARCHITECTURE §6.2), 0 a 100. Puro e testável.
 *
 * | componente                     | peso | cálculo                                          |
 * | tarefas que mexem faturamento  | 35   | feitas hoje / planejadas para hoje (máx. 3)       |
 * | abordagens                     | 25   | min(abordagens hoje / meta do dia, 1)             |
 * | foco                           | 20   | min(minutos de foco hoje / meta, 1)               |
 * | hábitos                        | 20   | feitos hoje / previstos para hoje                 |
 *
 * Componente sem dado (null) sai da conta e os pesos dos outros são redistribuídos
 * proporcionalmente. Fora dos dias úteis, abordagens e foco saem da conta.
 */

export type ScoreKey = "revenue_tasks" | "outreach" | "focus" | "habits";

export const SCORE_WEIGHTS: Record<ScoreKey, number> = {
  revenue_tasks: 35,
  outreach: 25,
  focus: 20,
  habits: 20,
};

export interface ScoreInput {
  /** Dia útil (settings.workdays)? Fora dele, abordagens e foco não contam. */
  workday: boolean;
  /** Tarefas que mexem faturamento: vencendo até hoje (abertas) + concluídas hoje. */
  revenueTasksPlanned: number;
  /** Dessas, quantas foram concluídas hoje (inclusive as sem prazo). */
  revenueTasksDone: number;
  /** null = ainda não existe (Pipeline chega na Fase 3). */
  outreachDone: number | null;
  outreachGoal: number | null;
  focusMinutes: number;
  focusGoalMinutes: number;
  habitsExpected: number;
  habitsDone: number;
}

export interface ScoreComponent {
  key: ScoreKey;
  weight: number;
  /** 0..1, ou null quando ficou fora da conta. */
  value: number | null;
}

export interface DayScore {
  score: number;
  components: ScoreComponent[];
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function revenueTasksValue(planned: number, done: number): number {
  const denom = Math.min(planned, 3);
  // Sem nada planejado: fez alguma mesmo assim = cheio; não fez nada = zero (incentiva planejar).
  if (denom === 0) return done > 0 ? 1 : 0;
  return clamp01(done / denom);
}

export function computeScore(input: ScoreInput): DayScore {
  const components: ScoreComponent[] = [
    { key: "revenue_tasks", weight: SCORE_WEIGHTS.revenue_tasks, value: revenueTasksValue(input.revenueTasksPlanned, input.revenueTasksDone) },
    {
      key: "outreach",
      weight: SCORE_WEIGHTS.outreach,
      value:
        input.workday && input.outreachDone !== null && input.outreachGoal !== null && input.outreachGoal > 0
          ? clamp01(input.outreachDone / input.outreachGoal)
          : null,
    },
    {
      key: "focus",
      weight: SCORE_WEIGHTS.focus,
      value: input.workday && input.focusGoalMinutes > 0 ? clamp01(input.focusMinutes / input.focusGoalMinutes) : null,
    },
    {
      key: "habits",
      weight: SCORE_WEIGHTS.habits,
      value: input.habitsExpected > 0 ? clamp01(input.habitsDone / input.habitsExpected) : null,
    },
  ];

  const counted = components.filter((c) => c.value !== null);
  const totalWeight = counted.reduce((s, c) => s + c.weight, 0);
  const raw = totalWeight > 0 ? counted.reduce((s, c) => s + c.weight * c.value!, 0) / totalWeight : 0;
  return { score: Math.round(raw * 100), components };
}

/**
 * Hábitos previstos para hoje: diários sempre; semanais (meta < 7) só enquanto a meta da
 * semana não foi batida sem contar hoje. Feitos = previstos que foram marcados hoje.
 */
export function habitsForToday(
  habits: readonly { id: string; target_per_week: number }[],
  weekCountExcludingToday: ReadonlyMap<string, number>,
  doneToday: ReadonlySet<string>,
): { expected: number; done: number } {
  let expected = 0;
  let done = 0;
  for (const h of habits) {
    const isExpected = h.target_per_week >= 7 || (weekCountExcludingToday.get(h.id) ?? 0) < h.target_per_week;
    if (!isExpected) continue;
    expected++;
    if (doneToday.has(h.id)) done++;
  }
  return { expected, done };
}

/** Princípio do dia: rotação estável pela data (mesmo princípio o dia inteiro). */
export function principleOfDay<T>(principles: readonly T[], todayIso: string): T | null {
  if (!principles.length) return null;
  const day = Math.floor(Date.parse(`${todayIso}T12:00:00Z`) / 86_400_000);
  return principles[day % principles.length]!;
}
