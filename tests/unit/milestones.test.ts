import { describe, expect, it } from "vitest";
import {
  achievementDays,
  choiceFromPeriod,
  monthChoices,
  moveInOrder,
  periodFromChoice,
  periodLabel,
} from "@/lib/metrics/milestones";

const TODAY = "2026-11-13";

describe("periodFromChoice", () => {
  it("mensal num mês específico vira início/fim/prazo do mês", () => {
    expect(periodFromChoice("revenue_month", { month: "2026-12" }, TODAY)).toEqual({
      period_start: "2026-12-01",
      period_end: "2026-12-31",
      deadline: "2026-12-31",
    });
    expect(periodFromChoice("net_month", { month: "2027-02" }, TODAY).period_end).toBe("2027-02-28");
  });
  it("mensal recorrente = tudo null", () => {
    expect(periodFromChoice("revenue_month", { month: "recorrente" }, TODAY)).toEqual({
      period_start: null,
      period_end: null,
      deadline: null,
    });
  });
  it("acumulada com prazo conta de hoje até o prazo", () => {
    expect(periodFromChoice("revenue_cumulative", { deadline: "2026-12-31" }, TODAY)).toEqual({
      period_start: TODAY,
      period_end: "2026-12-31",
      deadline: "2026-12-31",
    });
  });
  it("acumulada sem prazo e prazo no passado", () => {
    expect(periodFromChoice("mrr", {}, TODAY).deadline).toBeNull();
    expect(() => periodFromChoice("revenue_cumulative", { deadline: "2026-11-01" }, TODAY)).toThrow();
    expect(() => periodFromChoice("revenue_month", { month: "2026-13" }, TODAY)).toThrow();
  });
  it("ida e volta com choiceFromPeriod", () => {
    const p = periodFromChoice("revenue_month", { month: "2026-12" }, TODAY);
    expect(choiceFromPeriod("revenue_month", p)).toEqual({ month: "2026-12", deadline: null });
    expect(choiceFromPeriod("revenue_cumulative", { period_start: TODAY, period_end: "2027-01-31", deadline: "2027-01-31" })).toEqual({
      month: "recorrente",
      deadline: "2027-01-31",
    });
  });
});

describe("rótulos e meses", () => {
  it("periodLabel", () => {
    expect(periodLabel("revenue_month", { period_start: "2026-11-01", period_end: "2026-11-30", deadline: "2026-11-30" })).toBe("nov/2026");
    expect(periodLabel("net_month", { period_start: null, period_end: null, deadline: null })).toBe("todo mês");
    expect(periodLabel("revenue_cumulative", { period_start: TODAY, period_end: "2026-12-31", deadline: "2026-12-31" })).toBe("até 31/12/2026");
    expect(periodLabel("mrr", { period_start: null, period_end: null, deadline: null })).toBe("sem prazo");
  });
  it("monthChoices começa no mês atual e atravessa o ano", () => {
    const m = monthChoices(TODAY, 3);
    expect(m).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
});

describe("achievementDays", () => {
  it("conta do início do período até o dia em SP em que bateu", () => {
    // 28/11 às 23h em SP = 29/11 02:00Z — continua sendo dia 28 em SP.
    expect(achievementDays({ period_start: "2026-11-01", created_at: "2026-11-12T15:00:00Z", achieved_at: "2026-11-29T02:00:00Z" })).toBe(28);
  });
  it("sem período, conta da criação; mesmo dia = 1", () => {
    expect(achievementDays({ period_start: null, created_at: "2026-11-13T12:00:00Z", achieved_at: "2026-11-13T20:00:00Z" })).toBe(1);
    expect(achievementDays({ period_start: null, created_at: "2026-11-13T12:00:00Z", achieved_at: "2026-11-20T20:00:00Z" })).toBe(8);
  });
});

describe("moveInOrder", () => {
  it("sobe, desce e respeita as pontas", () => {
    expect(moveInOrder(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveInOrder(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveInOrder(["a"], "x", 1)).toEqual(["a"]);
  });
});
