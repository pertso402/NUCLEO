import { describe, expect, it } from "vitest";
import { addMonths, formatMonthLong, formatMonthShort, parseMonthKey } from "@/lib/dates";
import {
  categoryBreakdown,
  cumulativeIncome,
  groupByDay,
  lastMonthsSeries,
  monthTotals,
  type TxRow,
} from "@/lib/metrics/money-report";

const tx = (p: Partial<TxRow> & Pick<TxRow, "occurred_on" | "amount_cents" | "kind">): TxRow => ({
  category_id: null,
  status: "confirmed",
  ...p,
});

describe("datas de mês", () => {
  it("addMonths atravessa o ano e sempre devolve o dia 1", () => {
    expect(addMonths("2026-11-13", 0)).toBe("2026-11-01");
    expect(addMonths("2026-11-30", 2)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addMonths("2026-11-01", -11)).toBe("2025-12-01");
  });
  it("parseMonthKey valida", () => {
    expect(parseMonthKey("2026-11")).toBe("2026-11-01");
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("2026-1")).toBeNull();
    expect(parseMonthKey(undefined)).toBeNull();
  });
  it("rótulos em pt-BR", () => {
    expect(formatMonthLong("2026-11-01")).toBe("novembro de 2026");
    expect(formatMonthShort("2026-02-01")).toBe("fev");
  });
});

describe("monthTotals", () => {
  it("soma só confirmados e calcula saldo", () => {
    const rows = [
      tx({ occurred_on: "2026-11-02", amount_cents: 150000, kind: "income" }),
      tx({ occurred_on: "2026-11-03", amount_cents: 4000, kind: "expense" }),
      tx({ occurred_on: "2026-11-03", amount_cents: 999, kind: "expense" }),
      tx({ occurred_on: "2026-11-04", amount_cents: 50000, kind: "income", status: "pending_review" }),
    ];
    expect(monthTotals(rows, "2026-11-13")).toEqual({
      month: "2026-11-01",
      incomeCents: 150000,
      expenseCents: 4999,
      netCents: 145001,
    });
  });
  it("mês vazio = zeros", () => {
    expect(monthTotals([], "2026-11-01").netCents).toBe(0);
  });
});

describe("lastMonthsSeries", () => {
  it("12 meses em ordem, preenche zeros e aceita bigint como string", () => {
    const s = lastMonthsSeries(
      [
        { month: "2026-11-01", income_cents: "150000", expense_cents: "4999" },
        { month: "2026-01-01", income_cents: 100, expense_cents: 0 },
      ],
      "2026-11-01",
    );
    expect(s).toHaveLength(12);
    expect(s[0]!.month).toBe("2025-12-01");
    expect(s[11]).toEqual({ month: "2026-11-01", incomeCents: 150000, expenseCents: 4999, netCents: 145001 });
    expect(s[1]).toMatchObject({ month: "2026-01-01", incomeCents: 100 });
    expect(s[5]).toMatchObject({ incomeCents: 0, expenseCents: 0, netCents: 0 });
  });
});

describe("cumulativeIncome", () => {
  it("acumula por dia e para em hoje", () => {
    const rows = [
      tx({ occurred_on: "2026-11-02", amount_cents: 1000, kind: "income" }),
      tx({ occurred_on: "2026-11-02", amount_cents: 500, kind: "income" }),
      tx({ occurred_on: "2026-11-05", amount_cents: 2000, kind: "income" }),
      tx({ occurred_on: "2026-11-05", amount_cents: 9999, kind: "expense" }),
      tx({ occurred_on: "2026-11-06", amount_cents: 7, kind: "income", status: "pending_review" }),
    ];
    const s = cumulativeIncome(rows, "2026-11-01", "2026-11-13");
    expect(s).toHaveLength(30);
    expect(s[0]).toEqual({ date: "2026-11-01", cents: 0 });
    expect(s[1]!.cents).toBe(1500);
    expect(s[4]!.cents).toBe(3500);
    expect(s[12]).toEqual({ date: "2026-11-13", cents: 3500 });
    expect(s[13]!.cents).toBeNull();
  });
  it("mês passado inteiro preenchido", () => {
    expect(cumulativeIncome([], "2026-10-01", "2026-11-13").every((p) => p.cents === 0)).toBe(true);
  });
});

describe("categoryBreakdown", () => {
  it("ordena, nomeia e calcula participação", () => {
    const names = new Map([
      ["a", "Alimentação"],
      ["b", "Transporte"],
    ]);
    const rows = [
      tx({ occurred_on: "2026-11-02", amount_cents: 3000, kind: "expense", category_id: "a" }),
      tx({ occurred_on: "2026-11-02", amount_cents: 1000, kind: "expense", category_id: "a" }),
      tx({ occurred_on: "2026-11-03", amount_cents: 4000, kind: "expense", category_id: "b" }),
      tx({ occurred_on: "2026-11-03", amount_cents: 2000, kind: "expense", category_id: null }),
      tx({ occurred_on: "2026-11-03", amount_cents: 9000, kind: "income", category_id: "x" }),
    ];
    const s = categoryBreakdown(rows, "expense", names);
    expect(s.map((x) => x.name)).toEqual(["Alimentação", "Transporte", "Sem categoria"]);
    expect(s[0]).toMatchObject({ totalCents: 4000, count: 2, share: 0.4 });
    expect(s[2]!.share).toBeCloseTo(0.2);
  });
});

describe("groupByDay", () => {
  it("dias do mais recente pro mais antigo", () => {
    const g = groupByDay([
      { occurred_on: "2026-11-02", id: 1 },
      { occurred_on: "2026-11-05", id: 2 },
      { occurred_on: "2026-11-02", id: 3 },
    ]);
    expect(g.map((d) => d.date)).toEqual(["2026-11-05", "2026-11-02"]);
    expect(g[1]!.items.map((i) => i.id)).toEqual([1, 3]);
  });
});
