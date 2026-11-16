import { describe, expect, it } from "vitest";
import { buildColumns, isOverdue, isStaleProposal, nextStage, whatsappLink, type BoardLead } from "@/lib/metrics/pipeline";

const TODAY = "2026-11-16";
const lead = (id: string, p: Partial<BoardLead> = {}): BoardLead => ({
  id,
  name: id,
  business: null,
  stage: "abordado",
  next_action: "ligar",
  next_action_on: TODAY,
  monthly_value_cents: null,
  stage_changed_at: "2026-11-10T12:00:00Z",
  ...p,
});

describe("quadro do pipeline", () => {
  it("colunas na ordem do funil, com contagem e soma das mensalidades", () => {
    const cols = buildColumns([
      lead("b", { next_action_on: "2026-11-20" }),
      lead("a", { next_action_on: "2026-11-12" }),
      lead("p", { stage: "proposta", monthly_value_cents: 80_000 }),
      lead("q", { stage: "proposta", monthly_value_cents: 120_000 }),
      lead("f1", { stage: "fechado", next_action_on: null, stage_changed_at: "2026-11-01T00:00:00Z" }),
      lead("f2", { stage: "fechado", next_action_on: null, stage_changed_at: "2026-11-15T00:00:00Z" }),
    ]);
    expect(cols.map((c) => c.stage)).toEqual(["abordado", "conversou", "reuniao", "proposta", "fechado", "perdido"]);
    expect(cols[0]!.items.map((l) => l.id)).toEqual(["a", "b"]); // atrasado primeiro
    expect(cols[3]).toMatchObject({ count: 2, monthlyCents: 200_000 });
    expect(cols[4]!.items.map((l) => l.id)).toEqual(["f2", "f1"]); // mais recente primeiro
  });

  it("atrasado só para lead vivo com data antes de hoje", () => {
    expect(isOverdue({ stage: "conversou", next_action_on: "2026-11-15" }, TODAY)).toBe(true);
    expect(isOverdue({ stage: "conversou", next_action_on: TODAY }, TODAY)).toBe(false);
    expect(isOverdue({ stage: "fechado", next_action_on: "2026-11-01" }, TODAY)).toBe(false);
  });

  it("proposta parada há 7 dias pede follow-up", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    expect(isStaleProposal({ stage: "proposta", stage_changed_at: "2026-11-09T12:00:00Z" }, now)).toBe(true);
    expect(isStaleProposal({ stage: "proposta", stage_changed_at: "2026-11-10T12:00:00Z" }, now)).toBe(false);
    expect(isStaleProposal({ stage: "reuniao", stage_changed_at: "2026-10-01T12:00:00Z" }, now)).toBe(false);
  });

  it("avançar segue o funil e para no fechado", () => {
    expect(nextStage("abordado")).toBe("conversou");
    expect(nextStage("proposta")).toBe("fechado");
    expect(nextStage("fechado")).toBeNull();
    expect(nextStage("perdido")).toBeNull();
  });

  it("link de WhatsApp", () => {
    expect(whatsappLink("(11) 98765-4321")).toBe("https://wa.me/5511987654321");
    expect(whatsappLink("+55 11 98765-4321")).toBe("https://wa.me/5511987654321");
    expect(whatsappLink("123")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });
});
