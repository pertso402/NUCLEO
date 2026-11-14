import { describe, expect, it } from "vitest";
import { generateRecurring } from "@/lib/recurring";
import { fakeSupabase } from "./helpers/fake-supabase";

const U = "u1";
const NOW = new Date("2026-11-14T12:00:00Z"); // sábado 14/11, 9h em SP

const rule = (id: string, day: number, p: Record<string, unknown> = {}) => ({
  id,
  user_id: U,
  description: id,
  amount_cents: 120_000,
  kind: "expense",
  category_id: "c1",
  day_of_month: day,
  active: true,
  lead_id: null,
  last_generated_on: null,
  ...p,
});

function db(rules: Record<string, unknown>[], transactions: Record<string, unknown>[] = []) {
  return fakeSupabase({ recurring_rules: rules, transactions }, { transactions: ["user_id", "external_id"] });
}

describe("generateRecurring", () => {
  it("cria pendentes das regras vencidas e marca a regra; rodar de novo não duplica", async () => {
    const d = db([rule("Aluguel", 5), rule("Futuro", 20), rule("Pausada", 1, { active: false })]);
    const first = await generateRecurring(d.client, U, NOW);
    expect(first).toEqual({ created: [{ description: "Aluguel", dueOn: "2026-11-05" }], already: 0 });
    expect(d.tables.transactions).toMatchObject([
      {
        user_id: U,
        occurred_on: "2026-11-05",
        amount_cents: 120_000,
        kind: "expense",
        category_id: "c1",
        status: "pending_review",
        external_id: "recurring:Aluguel:2026-11",
      },
    ]);
    expect(d.tables.recurring_rules!.find((r) => r.id === "Aluguel")!.last_generated_on).toBe("2026-11-05");

    const second = await generateRecurring(d.client, U, NOW);
    expect(second).toEqual({ created: [], already: 0 });
    expect(d.tables.transactions).toHaveLength(1);
  });

  it("se o lançamento do mês já existe (external_id), não duplica e só marca a regra", async () => {
    const d = db([rule("Aluguel", 5)], [{ id: "t0", user_id: U, external_id: "recurring:Aluguel:2026-11" }]);
    expect(await generateRecurring(d.client, U, NOW)).toEqual({ created: [], already: 1 });
    expect(d.tables.transactions).toHaveLength(1);
    expect(d.tables.recurring_rules![0]!.last_generated_on).toBe("2026-11-05");
  });

  it("dry só lista, sem gravar nada", async () => {
    const d = db([rule("Aluguel", 5)]);
    expect((await generateRecurring(d.client, U, NOW, { dry: true })).created).toHaveLength(1);
    expect(d.log).toEqual([]);
  });

  it("ignora regras de outro usuário", async () => {
    const d = db([rule("Alheia", 5, { user_id: "outro" })]);
    expect((await generateRecurring(d.client, U, NOW)).created).toEqual([]);
  });
});
