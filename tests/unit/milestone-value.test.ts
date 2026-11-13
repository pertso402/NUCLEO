import { describe, expect, it } from "vitest";
import { computeMetricValue, metricDateRange, type MoneyRow } from "@/lib/metrics/milestone-value";

const NOV = { start: "2026-11-01", end: "2026-11-30" };
const rows: MoneyRow[] = [
  { occurred_on: "2026-10-31", amount_cents: 70_000, kind: "income" },
  { occurred_on: "2026-11-01", amount_cents: 150_000, kind: "income" },
  { occurred_on: "2026-11-15", amount_cents: "50050", kind: "income" }, // bigint chega como string às vezes
  { occurred_on: "2026-11-20", amount_cents: 3_890, kind: "expense" },
  { occurred_on: "2026-11-30", amount_cents: 10_000, kind: "income" },
  { occurred_on: "2026-12-01", amount_cents: 999_999, kind: "income" },
];

describe("computeMetricValue", () => {
  it("receita do mês: só receitas dentro do período (bordas inclusivas)", () => {
    expect(computeMetricValue("revenue_month", rows, NOV)).toBe(210_050);
  });
  it("receita acumulada: tudo até o fim do período", () => {
    expect(computeMetricValue("revenue_cumulative", rows, NOV)).toBe(280_050);
  });
  it("saldo do mês: receita − despesa (pode ficar negativo)", () => {
    expect(computeMetricValue("net_month", rows, NOV)).toBe(206_160);
    expect(computeMetricValue("net_month", [{ occurred_on: "2026-11-02", amount_cents: 500, kind: "expense" }], NOV)).toBe(-500);
  });
  it("MRR vale 0 até o pipeline existir (Fase 3)", () => {
    expect(computeMetricValue("mrr", rows, NOV)).toBe(0);
  });
  it("sem lançamentos = 0", () => {
    expect(computeMetricValue("revenue_month", [], NOV)).toBe(0);
  });
});

describe("metricDateRange", () => {
  it("acumulada busca desde sempre; as demais só o período", () => {
    expect(metricDateRange("revenue_cumulative", NOV)).toEqual({ from: null, to: "2026-11-30" });
    expect(metricDateRange("revenue_month", NOV)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });
});
