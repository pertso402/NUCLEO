import { describe, expect, it } from "vitest";
import { stageCounts, type StageEvent } from "@/lib/metrics/funnel";
import { lostReasons, originStats, type AnalyticsLead } from "@/lib/metrics/pipeline-analytics";

const NOW = new Date("2026-11-16T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const lead = (p: Partial<AnalyticsLead>): AnalyticsLead => ({
  stage: "abordado",
  origin: "abordagem_fria",
  lost_reason: null,
  monthly_value_cents: null,
  contract_status: null,
  created_at: daysAgo(10),
  stage_changed_at: daysAgo(5),
  ...p,
});

describe("análises do pipeline", () => {
  it("contagem crua por etapa (base das taxas)", () => {
    const ev = (lead: string, to: string): StageEvent => ({ lead_id: lead, to_stage: to, created_at: daysAgo(3) });
    const c = stageCounts([ev("a", "abordado"), ev("a", "conversou"), ev("b", "abordado"), ev("c", "reuniao")], NOW);
    expect(c.r1).toEqual({ sample: 2, advanced: 1 });
    expect(c.r3).toEqual({ sample: 1, advanced: 0 }); // c entrou direto em reunião
  });

  it("motivos de perda na janela, maior primeiro, com participação", () => {
    const r = lostReasons(
      [
        lead({ stage: "perdido", lost_reason: "preco" }),
        lead({ stage: "perdido", lost_reason: "preco" }),
        lead({ stage: "perdido", lost_reason: "timing" }),
        lead({ stage: "perdido", lost_reason: "preco", stage_changed_at: daysAgo(400) }), // fora da janela
        lead({ stage: "conversou" }),
      ],
      NOW,
    );
    expect(r.total).toBe(3);
    expect(r.items.map((i) => [i.reason, i.count])).toEqual([
      ["preco", 2],
      ["timing", 1],
    ]);
    expect(r.items[0]!.share).toBeCloseTo(2 / 3);
  });

  it("origem que mais fecha: fechados, taxa e MRR ativo", () => {
    const s = originStats(
      [
        lead({ origin: "indicacao", stage: "fechado", contract_status: "ativo", monthly_value_cents: 90_000 }),
        lead({ origin: "indicacao", stage: "fechado", contract_status: "encerrado", monthly_value_cents: 50_000 }),
        lead({ origin: "indicacao", stage: "proposta" }),
        lead({ origin: "abordagem_fria" }),
        lead({ origin: "abordagem_fria" }),
        lead({ origin: "abordagem_fria", stage: "fechado", contract_status: "ativo", monthly_value_cents: 80_000 }),
        lead({ origin: "instagram", created_at: daysAgo(300) }), // fora da janela
      ],
      NOW,
    );
    expect(s.map((o) => [o.origin, o.leads, o.closed, o.mrrCents])).toEqual([
      ["indicacao", 3, 2, 90_000],
      ["abordagem_fria", 3, 1, 80_000],
    ]);
    expect(s[0]!.closeRate).toBeCloseTo(2 / 3);
  });
});
