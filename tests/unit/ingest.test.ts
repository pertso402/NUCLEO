import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidApiToken } from "@/lib/api-auth";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { milestoneLine, resolveCategory, type Category } from "@/lib/ingest/executor";
import { buildSystemPrompt } from "@/lib/ingest/parser";
import { ToolCallSchema } from "@/lib/ingest/tools";

describe("isValidApiToken", () => {
  const original = process.env.NUCLEO_API_TOKEN;
  beforeEach(() => {
    process.env.NUCLEO_API_TOKEN = "segredo-de-teste";
  });
  afterEach(() => {
    process.env.NUCLEO_API_TOKEN = original;
  });
  it("aceita só o token exato", () => {
    expect(isValidApiToken("segredo-de-teste")).toBe(true);
    expect(isValidApiToken("segredo-de-test")).toBe(false);
    expect(isValidApiToken("segredo-de-teste ")).toBe(false);
    expect(isValidApiToken("")).toBe(false);
    expect(isValidApiToken(null)).toBe(false);
  });
  it("recusa tudo se o servidor não tem token configurado", () => {
    delete process.env.NUCLEO_API_TOKEN;
    expect(isValidApiToken("qualquer")).toBe(false);
  });
});

describe("rateLimit", () => {
  beforeEach(() => resetRateLimit());
  it("30 por minuto, depois bloqueia, e libera quando a janela passa", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) expect(rateLimit("k", 30, 60_000, t0 + i).ok).toBe(true);
    const blocked = rateLimit("k", 30, 60_000, t0 + 31);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(rateLimit("k", 30, 60_000, t0 + 60_001).ok).toBe(true);
  });
  it("chaves diferentes não se misturam", () => {
    for (let i = 0; i < 30; i++) rateLimit("a", 30, 60_000, 0);
    expect(rateLimit("b", 30, 60_000, 0).ok).toBe(true);
  });
});

const CATS: Category[] = [
  { id: "1", name: "Receita de cliente", kind: "income" },
  { id: "2", name: "Outras receitas", kind: "income" },
  { id: "3", name: "Alimentação", kind: "expense" },
  { id: "4", name: "Transporte/Combustível", kind: "expense" },
  { id: "5", name: "Outros", kind: "expense" },
];

describe("resolveCategory", () => {
  it("ignora acento e maiúsculas", () => {
    expect(resolveCategory(CATS, "expense", "alimentacao")?.id).toBe("3");
    expect(resolveCategory(CATS, "income", "RECEITA DE CLIENTE")?.id).toBe("1");
  });
  it("aceita nome parcial", () => {
    expect(resolveCategory(CATS, "expense", "Combustível")?.id).toBe("4");
  });
  it("sem encaixe cai em Outros / Outras receitas, respeitando o tipo", () => {
    expect(resolveCategory(CATS, "expense", "Pet shop")?.id).toBe("5");
    expect(resolveCategory(CATS, "income", "Pet shop")?.id).toBe("2");
    expect(resolveCategory(CATS, "income", "Alimentação")?.id).toBe("2"); // categoria de despesa não vale pra receita
  });
});

describe("milestoneLine", () => {
  it("formato do WhatsApp (ARCHITECTURE §5.2)", () => {
    expect(milestoneLine("R$ 10k de receita", { currentCents: 620_000, remainingCents: 380_000, pct: 0.62, achieved: false }))
      .toBe('📈 Marco "R$ 10k de receita": R$ 6.200 → faltam R$ 3.800 (62%)');
    expect(milestoneLine("R$ 10k de receita", { currentCents: 1_050_000, remainingCents: 0, pct: 1.05, achieved: true }))
      .toBe('🏆 Marco "R$ 10k de receita" batido! R$ 10.500');
  });
});

describe("buildSystemPrompt", () => {
  it("leva data de São Paulo e as categorias", () => {
    const p = buildSystemPrompt({
      now: new Date("2026-11-14T02:30:00Z"), // 13/11 23:30 em SP
      incomeCategories: ["Receita de cliente"],
      expenseCategories: ["Alimentação"],
    });
    expect(p).toContain("(2026-11-13), 23:30");
    expect(p).toContain("Categorias de receita: Receita de cliente.");
    expect(p).toContain("Categorias de despesa: Alimentação.");
  });
});

describe("ToolCallSchema", () => {
  it("valida o que o modelo devolve", () => {
    expect(ToolCallSchema.safeParse({ name: "add_transaction", args: { kind: "expense", amount: "38,90", category: "Alimentação", description: "almoço", counterparty: null, occurred_on: null } }).success).toBe(true);
    expect(ToolCallSchema.safeParse({ name: "add_transaction", args: { kind: "gasto", amount: "38", category: "x", description: null, counterparty: null, occurred_on: null } }).success).toBe(false);
    expect(ToolCallSchema.safeParse({ name: "add_transaction", args: { kind: "expense", amount: "38", category: "x", description: null, counterparty: null, occurred_on: "13/11" } }).success).toBe(false);
    expect(ToolCallSchema.safeParse({ name: "drop_table", args: {} }).success).toBe(false);
  });
});
