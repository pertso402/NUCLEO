import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/milestone", () => ({ loadHighlightMilestone: vi.fn() }));
vi.mock("@/lib/data/today", () => ({ loadToday: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { isAuthorizedCron } from "@/lib/api-auth";
import {
  acceptGenerated,
  fallbackBriefing,
  fallbackClosing,
  mustInclude,
  type BriefingFacts,
  type ClosingFacts,
  type MilestoneFacts,
} from "@/lib/briefing/compose";
import { dueText, fmtMinutes, milestoneFacts } from "@/lib/briefing/facts";
import { computePace } from "@/lib/metrics/pace";

const M: MilestoneFacts = {
  title: "R$ 10k de receita",
  current: "R$ 6.200",
  target: "R$ 10.000",
  remaining: "R$ 3.800",
  pct: 62,
  achieved: false,
  onTrack: false,
  neededPerDay: "R$ 346",
  bdLeft: 11,
};

const BRIEF: BriefingFacts = {
  kind: "briefing",
  dateLabel: "sexta-feira, 13 de novembro",
  milestone: M,
  revenueTasks: ["Cobrar parcela do Choppatinhas (atrasada desde 11/11)", "Mandar proposta pra Gelato (hoje)"],
  tasksDueCount: 4,
  habits: ["Academia", "Leitura"],
  focusGoal: "4h",
  principle: "Proposta enviada hoje vale mais que proposta perfeita.",
};

const CLOSE: ClosingFacts = {
  kind: "closing",
  dateLabel: "sexta-feira, 13 de novembro",
  score: 64,
  revenueDone: 2,
  revenuePlanned: 3,
  focus: "2h45",
  focusGoal: "4h",
  habitsDone: 2,
  habitsExpected: 3,
  incomeToday: "R$ 1.500",
  milestone: M,
  tomorrowCount: 2,
  reviewUrl: "https://nucleo-beta.vercel.app/revisao",
};

describe("mensagens de reserva (sem IA)", () => {
  it("briefing traz marco, ritmo, tarefas numeradas, resto, hábitos, foco e princípio", () => {
    expect(fallbackBriefing(BRIEF)).toBe(
      [
        "☀️ Bom dia, Peter. Sexta-feira, 13 de novembro.",
        "",
        "📈 R$ 10k de receita: R$ 6.200 de R$ 10.000 (62%) · faltam R$ 3.800",
        "⚠️ Abaixo do ritmo: precisa de R$ 346/dia útil (11 dias úteis).",
        "",
        "💰 Movem faturamento hoje:",
        "1. Cobrar parcela do Choppatinhas (atrasada desde 11/11)",
        "2. Mandar proposta pra Gelato (hoje)",
        "📋 Mais 2 tarefas pra hoje.",
        "🔁 Hábitos: Academia, Leitura.",
        "⏱️ Meta de foco: 4h.",
        "",
        "🧭 Proposta enviada hoje vale mais que proposta perfeita.",
      ].join("\n"),
    );
  });

  it("briefing sem marco nem tarefas pede o próximo passo", () => {
    const t = fallbackBriefing({ ...BRIEF, milestone: null, revenueTasks: [], tasksDueCount: 0, habits: [], focusGoal: "", principle: null });
    expect(t).toBe("☀️ Bom dia, Peter. Sexta-feira, 13 de novembro.\n\n💰 Nenhuma tarefa de faturamento na fila. Qual é o próximo passo pra entrar dinheiro?");
  });

  it("marco no ritmo e batido", () => {
    expect(fallbackBriefing({ ...BRIEF, milestone: { ...M, onTrack: true } })).toContain("✅ No ritmo. R$ 346/dia útil fecha o marco.");
    expect(fallbackBriefing({ ...BRIEF, milestone: { ...M, achieved: true } })).toContain('🏆 Marco "R$ 10k de receita" batido: R$ 6.200 de R$ 10.000.');
  });

  it("fechamento: placar, entrada do dia, marco, amanhã e link", () => {
    const t = fallbackClosing(CLOSE);
    expect(t.split("\n")[0]).toBe("🌙 Fechamento de sexta-feira, 13 de novembro: score 64/100.");
    expect(t).toContain("💰 Tarefas de faturamento: 2/3");
    expect(t).toContain("⏱️ Foco: 2h45 de 4h");
    expect(t).toContain("🔁 Hábitos: 2/3");
    expect(t).toContain("✅ Entrou hoje: R$ 1.500");
    expect(t).toContain("📋 Amanhã: 2 tarefas com prazo.");
    expect(t.endsWith("Revisão rápida (60s): https://nucleo-beta.vercel.app/revisao")).toBe(true);
  });
});

describe("texto da IA só passa se mantiver os fatos", () => {
  it("mustInclude: valores do marco, títulos das tarefas (sem prazo), score, link e entrada", () => {
    expect(mustInclude(BRIEF)).toEqual(["R$ 6.200", "R$ 3.800", "Cobrar parcela do Choppatinhas", "Mandar proposta pra Gelato"]);
    expect(mustInclude(CLOSE)).toEqual(["R$ 6.200", "R$ 3.800", "64", "https://nucleo-beta.vercel.app/revisao", "R$ 1.500"]);
  });

  it("aceita texto com tudo; recusa se mudou um valor, esqueceu uma tarefa ou ficou enorme", () => {
    const good = "Bom dia! R$ 6.200 de 10k, faltam R$ 3.800.\n1. Cobrar parcela do Choppatinhas\n2. Mandar proposta pra Gelato";
    expect(acceptGenerated(good, BRIEF)).toBe(true);
    expect(acceptGenerated(good.replace("R$ 3.800", "R$ 3,8 mil"), BRIEF)).toBe(false);
    expect(acceptGenerated(good.replace("2. Mandar proposta pra Gelato", ""), BRIEF)).toBe(false);
    expect(acceptGenerated(good + "x".repeat(1300), BRIEF)).toBe(false);
    expect(acceptGenerated("   ", BRIEF)).toBe(false);
  });
});

describe("ajudantes dos fatos", () => {
  it("duração e prazo", () => {
    expect(fmtMinutes(45)).toBe("45 min");
    expect(fmtMinutes(240)).toBe("4h");
    expect(fmtMinutes(165)).toBe("2h45");
    expect(dueText("2026-11-11", "2026-11-13")).toBe(" (atrasada desde 11/11)");
    expect(dueText("2026-11-13", "2026-11-13")).toBe(" (hoje)");
    expect(dueText("2026-11-14", "2026-11-13")).toBe(" (amanhã)");
    expect(dueText("2026-11-16", "2026-11-13")).toBe(" (seg 16/11)");
    expect(dueText(null, "2026-11-13")).toBe("");
  });

  it("milestoneFacts formata a partir do ritmo", () => {
    const pace = computePace({
      currentCents: 620_000,
      targetCents: 1_000_000,
      period: { start: "2026-11-01", end: "2026-11-30" },
      now: new Date("2026-11-13T15:00:00Z"),
    });
    const f = milestoneFacts({ milestone: { id: "m", title: "R$ 10k de receita", metricLabel: "", deadline: null }, pace })!;
    expect(f).toMatchObject({ title: "R$ 10k de receita", current: "R$ 6.200", target: "R$ 10.000", remaining: "R$ 3.800", pct: 62 });
    expect(milestoneFacts(null)).toBeNull();
  });
});

describe("autenticação do cron", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.NUCLEO_API_TOKEN = "token-nucleo";
    process.env.CRON_SECRET = "segredo-cron";
  });
  afterEach(() => {
    process.env = { ...env };
  });
  const h = (o: Record<string, string>) => new Headers(o);

  it("Vercel Cron (Bearer CRON_SECRET), manual (x-nucleo-token ou Bearer do token)", () => {
    expect(isAuthorizedCron(h({ authorization: "Bearer segredo-cron" }))).toBe(true);
    expect(isAuthorizedCron(h({ "x-nucleo-token": "token-nucleo" }))).toBe(true);
    expect(isAuthorizedCron(h({ authorization: "Bearer token-nucleo" }))).toBe(true);
  });

  it("recusa errado, vazio e sem segredo configurado", () => {
    expect(isAuthorizedCron(h({ authorization: "Bearer errado" }))).toBe(false);
    expect(isAuthorizedCron(h({ authorization: "segredo-cron" }))).toBe(false);
    expect(isAuthorizedCron(h({}))).toBe(false);
    delete process.env.CRON_SECRET;
    delete process.env.NUCLEO_API_TOKEN;
    expect(isAuthorizedCron(h({ authorization: "Bearer " }))).toBe(false);
  });
});
