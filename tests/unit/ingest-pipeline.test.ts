import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/milestone", () => ({
  loadHighlightMilestone: vi.fn(async () => null),
  syncAchievements: vi.fn(async () => []),
}));

import { composeReply, executeCalls, type ExecContext, type LeadLite, type RoutineState } from "@/lib/ingest/executor";
import { nextBusinessDay } from "@/lib/ingest/pipeline";
import { buildSystemPrompt } from "@/lib/ingest/parser";
import { ToolCallSchema, type ToolCall } from "@/lib/ingest/tools";
import { fakeSupabase } from "./helpers/fake-supabase";

const U = "user-1";
const NOW = new Date("2026-11-13T15:00:00Z"); // sexta 13/11, 12h SP

const lead = (id: string, p: Partial<LeadLite> = {}): LeadLite => ({
  id,
  name: id,
  business: null,
  stage: "conversou",
  next_action: "ligar",
  next_action_on: "2026-11-16",
  ...p,
});

function setup(leads: LeadLite[] = [], seed: Record<string, Record<string, unknown>[]> = {}) {
  const db = fakeSupabase(
    {
      crm_leads: leads.map((l) => ({ ...l, user_id: U, lost_reason: null, monthly_value_cents: null, contract_status: null, closed_at: null })),
      ...seed,
    },
    {},
    { crm_leads: { stage: "abordado" } },
  );
  const routine: RoutineState = { leads: [...leads], habits: [], openTasks: [], goals: [], projects: [], openTimer: null };
  const ctx: ExecContext = { supabase: db.client, userId: U, inboxId: "inbox-now", source: "whatsapp", now: NOW, categories: [], routine };
  return { db, ctx, run: (calls: ToolCall[]) => executeCalls(calls, ctx) };
}

describe("create_lead", () => {
  it("cria com próximo passo; sem data vira o próximo dia útil", async () => {
    const { db, run } = setup();
    const [a, b] = await run([
      {
        name: "create_lead",
        args: { name: "João", business: "Padaria Pão Quente", origin: null, stage: "abordado", next_action: "ligar de novo", next_action_on: "2026-11-19" },
      },
      { name: "create_lead", args: { name: "Bia", business: null, origin: "instagram", stage: "conversou", next_action: null, next_action_on: null } },
    ]);
    expect(a!.line).toBe("✅ Lead: João (Padaria Pão Quente) · abordado · próximo: ligar de novo (qui 19/11)");
    expect(a!.outreachAdded).toBe(true);
    expect(b!.line).toBe("✅ Lead: Bia · conversou · próximo: fazer follow-up (seg 16/11)");
    expect(b!.outreachAdded).toBe(false);
    expect(db.tables.crm_leads).toMatchObject([
      { user_id: U, name: "João", business: "Padaria Pão Quente", origin: "abordagem_fria", stage: "abordado", next_action_on: "2026-11-19" },
      { name: "Bia", origin: "instagram", next_action: "Fazer follow-up", next_action_on: "2026-11-16" },
    ]);
  });

  it("não duplica quem já está no pipeline", async () => {
    const { db, run } = setup([lead("l1", { name: "Ana", business: "Açaí Tropical" })]);
    const [o] = await run([
      { name: "create_lead", args: { name: "Ana", business: "Açaí Tropical", origin: null, stage: "abordado", next_action: null, next_action_on: null } },
    ]);
    expect(o).toMatchObject({ ok: false, clarification: true });
    expect(db.tables.crm_leads).toHaveLength(1);
  });
});

describe("update_lead", () => {
  const base = { stage: null, next_action: null, next_action_on: null, lost_reason: null, monthly_value: null, note: null } as const;

  it("fecha com mensalidade, limpa próximo passo e guarda o anterior para o desfaz", async () => {
    const { db, run } = setup([lead("l1", { name: "Pizzaria Forno", stage: "reuniao" })]);
    const [o] = await run([{ name: "update_lead", args: { ...base, lead_ref: "forno", stage: "fechado", monthly_value: "800" } }]);
    expect(o!.line).toBe("✅ Pizzaria Forno: reunião → fechado · R$ 800/mês");
    expect(db.tables.crm_leads![0]).toMatchObject({ stage: "fechado", monthly_value_cents: 80_000, next_action: null, next_action_on: null });
    expect(o!.updated![0]).toMatchObject({
      table: "crm_leads",
      id: "l1",
      before: { stage: "reuniao", monthly_value_cents: null, next_action: "ligar", next_action_on: "2026-11-16", contract_status: null },
    });
  });

  it("perdido sem motivo pergunta; com motivo grava", async () => {
    const { db, run } = setup([lead("l1", { name: "Mercado Bom Preço", stage: "proposta" })]);
    const [a] = await run([{ name: "update_lead", args: { ...base, lead_ref: "bom preço", stage: "perdido" } }]);
    expect(a).toMatchObject({ ok: false, clarification: true });
    expect(db.tables.crm_leads![0]!.stage).toBe("proposta");
    const [b] = await run([{ name: "update_lead", args: { ...base, lead_ref: "bom preço", stage: "perdido", lost_reason: "preco" } }]);
    expect(b!.line).toBe("✅ Mercado Bom Preço: proposta → perdido · motivo: preço");
    expect(db.tables.crm_leads![0]).toMatchObject({ stage: "perdido", lost_reason: "preco", next_action: null });
  });

  it("muda etapa e próximo passo; data no passado vira o próximo dia útil", async () => {
    const { db, run } = setup([lead("l1", { name: "Ana", business: "Açaí Tropical" })]);
    const [o] = await run([
      { name: "update_lead", args: { ...base, lead_ref: "Ana", stage: "reuniao", next_action: "reunião", next_action_on: "2026-11-17" } },
    ]);
    expect(o!.line).toBe("✅ Ana (Açaí Tropical): conversou → reunião · próximo: reunião (ter 17/11)");
    const [p] = await run([{ name: "update_lead", args: { ...base, lead_ref: "açaí", next_action_on: "2026-11-01" } }]);
    expect(p!.line).toContain("(seg 16/11)");
    expect(db.tables.crm_leads![0]!.next_action_on).toBe("2026-11-16");
  });

  it("nota vira evento; lead desconhecido ou ambíguo pergunta", async () => {
    const { db, run } = setup([lead("l1", { name: "Carlos", business: "Sorveteria" }), lead("l2", { name: "Carla", business: "Sorveteria Gelato" })]);
    const [n] = await run([{ name: "update_lead", args: { ...base, lead_ref: "Carlos", note: "prefere falar à tarde" } }]);
    expect(n!.line).toBe("✅ Carlos (Sorveteria): nota salva");
    expect(db.tables.crm_lead_events).toMatchObject([{ lead_id: "l1", type: "note", payload: { text: "prefere falar à tarde" } }]);
    const [x] = await run([{ name: "update_lead", args: { ...base, lead_ref: "Padaria Central" } }]);
    expect(x!.line).toContain('Não achei o lead "Padaria Central"');
    const [y] = await run([{ name: "update_lead", args: { ...base, lead_ref: "sorveteria" } }]);
    expect(y!.line).toContain("Qual lead?");
  });

  it("'atualizar' alguém fora da lista em etapa viva cadastra como novo; fechado/perdido pergunta", async () => {
    const { db, run } = setup();
    const [o] = await run([
      { name: "update_lead", args: { ...base, lead_ref: "Carlos", stage: "proposta", next_action: "mandar proposta", next_action_on: "2026-11-16" } },
    ]);
    expect(o!.line).toBe("✅ Lead: Carlos · proposta · próximo: mandar proposta (seg 16/11)");
    expect(db.tables.crm_leads).toMatchObject([{ name: "Carlos", stage: "proposta" }]);
    const [x] = await run([{ name: "update_lead", args: { ...base, lead_ref: "Desconhecido", stage: "fechado" } }]);
    expect(x).toMatchObject({ ok: false, clarification: true });
  });

  it("valor de mensalidade ilegível pergunta", async () => {
    const { run } = setup([lead("l1", { name: "Forno" })]);
    const [o] = await run([{ name: "update_lead", args: { ...base, lead_ref: "forno", stage: "fechado", monthly_value: "um bocado" } }]);
    expect(o).toMatchObject({ ok: false, clarification: true });
  });
});

describe("log_outreach e resposta", () => {
  it("registra e a resposta traz o total de abordagens do dia", async () => {
    const { db, ctx, run } = setup([], { outreach_logs: [{ id: "o0", user_id: U, log_date: "2026-11-13", count: 3, channel: null }] });
    const outcomes = await run([{ name: "log_outreach", args: { count: 5, channel: "whatsapp" } }]);
    expect(outcomes[0]!.line).toBe("✅ Abordagens: +5 (whatsapp)");
    expect(db.tables.outreach_logs).toHaveLength(2);
    expect(await composeReply(outcomes, ctx)).toBe('✅ Abordagens: +5 (whatsapp)\n📣 Abordagens hoje: 8\n↩️ "desfaz" pra reverter');
  });
});

describe("desfaz do pipeline", () => {
  it("restaura o lead e apaga os eventos de etapa desde a mudança", async () => {
    const since = "2026-11-13T14:59:59.000Z";
    const seed = {
      inbox_messages: [
        {
          id: "inbox-1",
          user_id: U,
          status: "ok",
          result: {
            created: [],
            updated: [{ table: "crm_leads", id: "l1", before: { stage: "reuniao", monthly_value_cents: null }, since }],
            lines: ["✅ Forno: reunião → fechado"],
          },
        },
      ],
      crm_lead_events: [
        { id: "e-old", user_id: U, lead_id: "l1", type: "stage_change", created_at: "2026-11-10T12:00:00.000Z" },
        { id: "e-new", user_id: U, lead_id: "l1", type: "stage_change", created_at: "2026-11-13T15:00:00.000Z" },
        { id: "e-note", user_id: U, lead_id: "l1", type: "note", created_at: "2026-11-13T15:00:00.000Z" },
      ],
    };
    const { db, run } = setup([lead("l1", { name: "Forno", stage: "fechado" })], seed);
    const [o] = await run([{ name: "undo_last", args: {} }]);
    expect(o!.line).toBe("↩️ Desfeito: Forno: reunião → fechado");
    expect(db.tables.crm_leads![0]).toMatchObject({ stage: "reuniao", monthly_value_cents: null });
    expect(db.tables.crm_lead_events!.map((e) => e.id)).toEqual(["e-old", "e-note"]);
  });
});

describe("parser: pipeline", () => {
  it("prompt leva os leads e a regra de fechamento não ser receita", () => {
    const p = buildSystemPrompt({ now: NOW, incomeCategories: [], expenseCategories: [], leads: ["Ana · Açaí Tropical · conversou"] });
    expect(p).toContain('Leads: "Ana · Açaí Tropical · conversou".');
    expect(p).toContain("NÃO é receita");
    expect(buildSystemPrompt({ now: NOW, incomeCategories: [], expenseCategories: [] })).toContain("Leads: nenhum.");
  });

  it("esquema das ferramentas novas", () => {
    const ok = (c: unknown) => ToolCallSchema.safeParse(c).success;
    expect(ok({ name: "log_outreach", args: { count: 5, channel: null } })).toBe(true);
    expect(ok({ name: "log_outreach", args: { count: 0, channel: null } })).toBe(false);
    expect(ok({ name: "create_lead", args: { name: "x", business: null, origin: null, stage: "fechado", next_action: null, next_action_on: null } })).toBe(false);
    expect(ok({ name: "update_lead", args: { lead_ref: "x", stage: "perdido", next_action: null, next_action_on: null, lost_reason: "caro", monthly_value: null, note: null } })).toBe(false);
  });

  it("próximo dia útil pula o fim de semana", () => {
    expect(nextBusinessDay("2026-11-13")).toBe("2026-11-16"); // sexta → segunda
    expect(nextBusinessDay("2026-11-16")).toBe("2026-11-17");
  });
});

describe("3.8: receita vinculada a lead e MRR", () => {
  const base = { stage: null, next_action: null, next_action_on: null, lost_reason: null, monthly_value: null, note: null } as const;

  it("fechar lead marca mrrChanged; só mudar próximo passo não", async () => {
    const { run } = setup([lead("l1", { name: "Pizzaria Forno", stage: "reuniao" }), lead("l2", { name: "Ana" })]);
    const [a] = await run([{ name: "update_lead", args: { ...base, lead_ref: "forno", stage: "fechado", monthly_value: "800" } }]);
    expect(a!.mrrChanged).toBe(true);
    const [b] = await run([{ name: "update_lead", args: { ...base, lead_ref: "Ana", next_action: "ligar", next_action_on: "2026-11-18" } }]);
    expect(b!.mrrChanged).toBe(false);
  });

  it("receita de cliente do pipeline grava lead_id (pelo lead_ref ou pelo cliente citado)", async () => {
    const { db, ctx, run } = setup([lead("l1", { name: "Pizzaria Forno" }), lead("l2", { name: "Ana", business: "Açaí Tropical" })]);
    ctx.categories = [{ id: "c1", name: "Receita de cliente", kind: "income" }];
    const [a, b, c] = await run([
      { name: "add_transaction", args: { kind: "income", amount: "800", category: "Receita de cliente", description: null, counterparty: null, occurred_on: null, lead_ref: "Forno" } },
      { name: "add_transaction", args: { kind: "income", amount: "300", category: "Receita de cliente", description: null, counterparty: "Açaí Tropical", occurred_on: null, lead_ref: null } },
      { name: "add_transaction", args: { kind: "income", amount: "50", category: "Receita de cliente", description: null, counterparty: "Fulano", occurred_on: null, lead_ref: null } },
    ]);
    expect(db.tables.transactions!.map((t) => t.lead_id)).toEqual(["l1", "l2", null]);
    expect(a!.line).toContain("cliente: Pizzaria Forno");
    expect(b!.line).not.toContain("cliente:");
    expect(c!.line).not.toContain("cliente:");
  });
});
