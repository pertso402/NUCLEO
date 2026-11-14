import { describe, expect, it } from "vitest";
import { computeScore, habitsForToday, principleOfDay, revenueTasksValue, type ScoreInput } from "@/lib/metrics/score";

const base: ScoreInput = {
  workday: true,
  revenueTasksPlanned: 3,
  revenueTasksDone: 3,
  outreachDone: 10,
  outreachGoal: 10,
  focusMinutes: 240,
  focusGoalMinutes: 240,
  habitsExpected: 4,
  habitsDone: 4,
};

describe("computeScore", () => {
  it("tudo feito = 100; nada feito = 0", () => {
    expect(computeScore(base).score).toBe(100);
    expect(
      computeScore({ ...base, revenueTasksDone: 0, outreachDone: 0, focusMinutes: 0, habitsDone: 0 }).score,
    ).toBe(0);
  });

  it("pesos 35/25/20/20", () => {
    // só as tarefas: 35
    expect(computeScore({ ...base, outreachDone: 0, focusMinutes: 0, habitsDone: 0 }).score).toBe(35);
    // metade de cada: 50
    expect(
      computeScore({ ...base, revenueTasksDone: 1, revenueTasksPlanned: 2, outreachDone: 5, focusMinutes: 120, habitsDone: 2 }).score,
    ).toBe(50);
  });

  it("componente sem dado sai e os pesos se redistribuem (abordagens até a Fase 3)", () => {
    const s = computeScore({ ...base, outreachDone: null, outreachGoal: null, focusMinutes: 0, habitsDone: 0 });
    expect(s.components.find((c) => c.key === "outreach")!.value).toBeNull();
    expect(s.score).toBe(Math.round((35 / 75) * 100)); // 47
  });

  it("fim de semana: abordagens e foco saem; tarefas e hábitos dividem o peso", () => {
    const s = computeScore({ ...base, workday: false, revenueTasksDone: 0, habitsDone: 4, focusMinutes: 0 });
    expect(s.components.filter((c) => c.value === null).map((c) => c.key)).toEqual(["outreach", "focus"]);
    expect(s.score).toBe(Math.round((20 / 55) * 100)); // 36
  });

  it("valores passam do teto? não: limita a 1", () => {
    expect(computeScore({ ...base, focusMinutes: 600, outreachDone: 30 }).score).toBe(100);
  });

  it("sem nenhum componente válido = 0", () => {
    expect(
      computeScore({ ...base, workday: false, revenueTasksPlanned: 0, revenueTasksDone: 0, habitsExpected: 0 }).score,
    ).toBe(0);
  });
});

describe("revenueTasksValue", () => {
  it("máximo de 3 no denominador", () => {
    expect(revenueTasksValue(5, 3)).toBe(1);
    expect(revenueTasksValue(5, 1)).toBeCloseTo(1 / 3);
    expect(revenueTasksValue(2, 1)).toBe(0.5);
  });
  it("nada planejado: feito alguma = cheio, nenhuma = zero", () => {
    expect(revenueTasksValue(0, 1)).toBe(1);
    expect(revenueTasksValue(0, 0)).toBe(0);
  });
});

describe("habitsForToday", () => {
  const habits = [
    { id: "diario", target_per_week: 7 },
    { id: "3x", target_per_week: 3 },
    { id: "2x-batido", target_per_week: 2 },
  ];
  it("diário sempre previsto; semanal só se a meta da semana não foi batida antes de hoje", () => {
    const week = new Map([["3x", 1], ["2x-batido", 2]]);
    expect(habitsForToday(habits, week, new Set())).toEqual({ expected: 2, done: 0 });
    expect(habitsForToday(habits, week, new Set(["diario", "2x-batido"]))).toEqual({ expected: 2, done: 1 });
    expect(habitsForToday(habits, week, new Set(["diario", "3x"]))).toEqual({ expected: 2, done: 2 });
  });
});

describe("principleOfDay", () => {
  it("estável no dia, roda entre dias, nulo sem princípios", () => {
    const ps = ["a", "b", "c"];
    const d1 = principleOfDay(ps, "2026-11-13");
    expect(principleOfDay(ps, "2026-11-13")).toBe(d1);
    const seq = ["2026-11-13", "2026-11-14", "2026-11-15"].map((d) => principleOfDay(ps, d));
    expect(new Set(seq).size).toBe(3);
    expect(principleOfDay([], "2026-11-13")).toBeNull();
  });
});
