import { describe, expect, it } from "vitest";
import { dueDateInMonth, initialLastGenerated, recurringExternalId, rulesDue } from "@/lib/metrics/recurring";

const rule = (id: string, day: number, last: string | null = null, active = true) => ({
  id,
  day_of_month: day,
  active,
  last_generated_on: last,
});

describe("dueDateInMonth", () => {
  it("dia normal e fim de mês curto", () => {
    expect(dueDateInMonth(5, "2026-11-14")).toBe("2026-11-05");
    expect(dueDateInMonth(31, "2026-11-14")).toBe("2026-11-30");
    expect(dueDateInMonth(31, "2027-02-10")).toBe("2027-02-28");
    expect(dueDateInMonth(29, "2028-02-10")).toBe("2028-02-29");
  });
});

describe("rulesDue", () => {
  const TODAY = "2026-11-14";
  it("gera o que venceu neste mês e ainda não foi gerado", () => {
    const due = rulesDue(
      [
        rule("aluguel", 5), // venceu dia 5, nunca gerou → gera (atrasado)
        rule("hoje", 14), // vence hoje → gera
        rule("futuro", 20), // ainda não venceu
        rule("ja", 10, "2026-11-10"), // já gerou este mês
        rule("mes-passado", 10, "2026-10-10"), // gerou mês passado → gera este
        rule("inativa", 1, null, false),
      ],
      TODAY,
    );
    expect(due.map((d) => [d.rule.id, d.dueOn])).toEqual([
      ["aluguel", "2026-11-05"],
      ["hoje", "2026-11-14"],
      ["mes-passado", "2026-11-10"],
    ]);
  });

  it("dia 31 em novembro vence dia 30", () => {
    expect(rulesDue([rule("x", 31)], "2026-11-30").map((d) => d.dueOn)).toEqual(["2026-11-30"]);
    expect(rulesDue([rule("x", 31)], "2026-11-29")).toEqual([]);
  });
});

describe("criação e idempotência", () => {
  it("dia que já passou neste mês começa no próximo; hoje ou futuro gera neste", () => {
    expect(initialLastGenerated(5, "2026-11-14")).toBe("2026-11-05");
    expect(initialLastGenerated(14, "2026-11-14")).toBeNull();
    expect(initialLastGenerated(20, "2026-11-14")).toBeNull();
    // com o last_generated_on inicial, a regra criada hoje não gera o dia 5 que já passou
    expect(rulesDue([rule("aluguel", 5, initialLastGenerated(5, "2026-11-14"))], "2026-11-14")).toEqual([]);
    expect(rulesDue([rule("aluguel", 5, "2026-11-05")], "2026-12-05").map((d) => d.dueOn)).toEqual(["2026-12-05"]);
  });

  it("external_id por regra e mês", () => {
    expect(recurringExternalId("r1", "2026-11-05")).toBe("recurring:r1:2026-11");
  });
});
