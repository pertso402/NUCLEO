import { describe, expect, it } from "vitest";
import { averageTicket, computeRates, DEFAULT_RATES, parseDefaultRates, reverseFunnel, type StageEvent } from "@/lib/metrics/funnel";

const NOW = new Date("2026-11-16T15:00:00Z");
const ev = (lead: string, to: string, daysAgo = 5): StageEvent => ({
  lead_id: lead,
  to_stage: to,
  created_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
});

describe("reverseFunnel (ARCHITECTURE §6.3)", () => {
  it("cadeia de ceil do marco até abordagens por dia", () => {
    // falta R$ 9.000 de mensalidade, ticket R$ 900 → 10 contratos
    const f = reverseFunnel({ remainingCents: 900_000, ticketCents: 90_000, rates: DEFAULT_RATES, openProposals: 0, bdLeft: 10 });
    expect(f).toEqual({
      contractsNeeded: 10,
      pipelineCredit: 0,
      contracts: 10,
      proposals: 29, // 10 / 0,35 = 28,57
      meetings: 42, // 29 / 0,7 = 41,4
      conversations: 105, // 42 / 0,4
      outreach: 350, // 105 / 0,3
      perDay: 35,
    });
  });

  it("propostas abertas abatem contratos antes de calcular abordagens", () => {
    const f = reverseFunnel({ remainingCents: 270_000, ticketCents: 90_000, rates: DEFAULT_RATES, openProposals: 4, bdLeft: 10 });
    expect(f.contractsNeeded).toBe(3);
    expect(f.pipelineCredit).toBeCloseTo(1.4);
    expect(f.contracts).toBe(2); // ceil(3 − 1,4)
  });

  it("marco batido ou pipeline cobrindo tudo = zero abordagens", () => {
    expect(reverseFunnel({ remainingCents: 0, ticketCents: 90_000, rates: DEFAULT_RATES, openProposals: 0, bdLeft: 10 }).perDay).toBe(0);
    expect(reverseFunnel({ remainingCents: 90_000, ticketCents: 90_000, rates: DEFAULT_RATES, openProposals: 3, bdLeft: 10 })).toMatchObject({
      contracts: 0,
      outreach: 0,
      perDay: 0,
    });
  });

  it("por dia tem mínimo 1 enquanto falta algo, e bdLeft 0 vira 1", () => {
    const f = reverseFunnel({ remainingCents: 10_000, ticketCents: 90_000, rates: { r1: 1, r2: 1, r3: 1, r4: 1 }, openProposals: 0, bdLeft: 20 });
    expect(f).toMatchObject({ contracts: 1, outreach: 1, perDay: 1 });
    // 1 contrato → 3 propostas → 5 reuniões → 13 conversas → 44 abordagens, tudo num dia só
    expect(reverseFunnel({ remainingCents: 90_000, ticketCents: 90_000, rates: DEFAULT_RATES, openProposals: 0, bdLeft: 0 }).perDay).toBe(44);
  });
});

describe("computeRates", () => {
  it("amostra pequena usa o padrão e marca estimado", () => {
    const r = computeRates([ev("a", "abordado"), ev("a", "conversou")], DEFAULT_RATES, NOW);
    expect(r.r1).toEqual({ rate: 0.3, sample: 1, estimated: true });
  });

  it("com amostra ≥ 10 calcula a taxa real; pular etapa conta como avanço; perdido não", () => {
    const events: StageEvent[] = [];
    for (let i = 0; i < 10; i++) events.push(ev(`l${i}`, "abordado"));
    events.push(ev("l0", "conversou"), ev("l1", "conversou"), ev("l2", "reuniao")); // l2 pulou conversou
    events.push(ev("l3", "perdido"));
    const r = computeRates(events, DEFAULT_RATES, NOW);
    expect(r.r1).toEqual({ rate: 0.3, sample: 10, estimated: false });
  });

  it("ignora eventos fora da janela e leads que entraram depois da etapa", () => {
    const events: StageEvent[] = [];
    for (let i = 0; i < 10; i++) events.push(ev(`old${i}`, "abordado", 120), ev(`old${i}`, "conversou", 100));
    events.push(ev("novo", "proposta")); // criado já em proposta: não entra na amostra de r1
    const r = computeRates(events, DEFAULT_RATES, NOW);
    expect(r.r1.sample).toBe(0);
    expect(r.r4.sample).toBe(1);
  });
});

describe("ticket e padrões", () => {
  it("média dos fechados recentes; senão o padrão", () => {
    const closed = [
      { monthly_value_cents: 80_000, closed_at: "2026-11-01T00:00:00Z" },
      { monthly_value_cents: 100_000, closed_at: "2026-10-01T00:00:00Z" },
      { monthly_value_cents: 500_000, closed_at: "2026-01-01T00:00:00Z" }, // fora dos 180 dias
      { monthly_value_cents: null, closed_at: "2026-11-02T00:00:00Z" },
    ];
    expect(averageTicket(closed, 70_000, NOW)).toEqual({ ticketCents: 90_000, sample: 2, estimated: false });
    expect(averageTicket([], 70_000, NOW)).toEqual({ ticketCents: 70_000, sample: 0, estimated: true });
    expect(averageTicket([], null, NOW).ticketCents).toBeNull();
  });

  it("default_conv_rates inválido cai no padrão por chave", () => {
    expect(parseDefaultRates({ r1: 0.2, r2: "x", r3: 2, r4: 0.5 })).toEqual({ r1: 0.2, r2: 0.4, r3: 0.7, r4: 0.5 });
    expect(parseDefaultRates(null)).toEqual(DEFAULT_RATES);
  });
});
