import { describe, expect, it } from "vitest";
import {
  addQuarters,
  goalPace,
  isQuarter,
  metricProgress,
  parseDecimal,
  quarterElapsed,
  quarterLabel,
  quarterOf,
  quarterRange,
} from "@/lib/metrics/goals";

describe("trimestres", () => {
  it("quarterOf", () => {
    expect(quarterOf("2026-11-13")).toBe("2026-Q4");
    expect(quarterOf("2026-01-01")).toBe("2026-Q1");
    expect(quarterOf("2026-03-31")).toBe("2026-Q1");
    expect(quarterOf("2026-04-01")).toBe("2026-Q2");
  });
  it("addQuarters atravessa o ano", () => {
    expect(addQuarters("2026-Q4", 1)).toBe("2027-Q1");
    expect(addQuarters("2026-Q1", -1)).toBe("2025-Q4");
    expect(addQuarters("2026-Q2", 6)).toBe("2027-Q4");
  });
  it("quarterRange com fim de mês certo (inclusive bissexto)", () => {
    expect(quarterRange("2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(quarterRange("2028-Q1")).toEqual({ start: "2028-01-01", end: "2028-03-31" });
    expect(quarterRange("2026-Q2")).toEqual({ start: "2026-04-01", end: "2026-06-30" });
  });
  it("rótulo e validação", () => {
    expect(quarterLabel("2026-Q4")).toBe("4º tri · out–dez 2026");
    expect(isQuarter("2026-Q4")).toBe(true);
    expect(isQuarter("2026-Q5")).toBe(false);
    expect(isQuarter(null)).toBe(false);
  });
  it("quanto do trimestre passou", () => {
    expect(quarterElapsed("2026-Q4", "2026-11-13")).toEqual({ day: 44, total: 92, pct: 44 / 92 });
    expect(quarterElapsed("2026-Q4", "2026-09-01").day).toBe(0);
    expect(quarterElapsed("2026-Q4", "2027-02-01").pct).toBe(1);
  });
});

describe("parseDecimal", () => {
  it("formatos pt-BR", () => {
    expect(parseDecimal("12")).toBe(12);
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal("1.200")).toBe(1200);
    expect(parseDecimal("1.200,75")).toBe(1200.75);
    expect(parseDecimal("0.5")).toBe(0.5);
  });
  it("vazio e lixo", () => {
    expect(parseDecimal("  ")).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
    expect(parseDecimal("1,2,3")).toBeNaN();
  });
});

describe("progresso e ritmo", () => {
  it("metricProgress", () => {
    expect(metricProgress(5, 10)).toBe(0.5);
    expect(metricProgress(null, 10)).toBe(0);
    expect(metricProgress(15, 10)).toBe(1.5);
    expect(metricProgress(5, null)).toBeNull();
    expect(metricProgress(5, 0)).toBeNull();
  });
  it("goalPace compara com o tempo que passou", () => {
    expect(goalPace(0.5, 0.48)).toBe("frente");
    expect(goalPace(0.42, 0.48)).toBe("perto");
    expect(goalPace(0.2, 0.48)).toBe("atras");
    expect(goalPace(1.1, 1)).toBe("frente");
    expect(goalPace(null, 0.5)).toBeNull();
  });
});
