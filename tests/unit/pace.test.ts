import { describe, expect, it } from "vitest";
import { businessDaysElapsed, computePace, resolvePeriod } from "@/lib/metrics/pace";

// Novembro/2026: começa num domingo, 21 dias úteis. Dia 12 é quinta.
const NOV = { start: "2026-11-01", end: "2026-11-30" };
const TARGET = 1_000_000; // R$ 10.000
// Instantes em UTC; São Paulo = UTC-3.
const at = (isoUtc: string) => new Date(isoUtc);
const NOV12_15H = at("2026-11-12T18:00:00Z");
const NOV12_10H = at("2026-11-12T13:00:00Z");

describe("businessDaysElapsed", () => {
  it("hoje só conta depois das 12h em SP", () => {
    expect(businessDaysElapsed(NOV, NOV12_10H)).toBe(8);
    expect(businessDaysElapsed(NOV, NOV12_15H)).toBe(9);
  });
  it("fim de semana não avança o contador", () => {
    expect(businessDaysElapsed(NOV, at("2026-11-14T18:00:00Z"))).toBe(10); // sábado
    expect(businessDaysElapsed(NOV, at("2026-11-15T18:00:00Z"))).toBe(10); // domingo
  });
  it("antes do período = 0; depois do período = total", () => {
    expect(businessDaysElapsed({ start: "2026-12-01", end: "2026-12-31" }, NOV12_15H)).toBe(0);
    expect(businessDaysElapsed(NOV, at("2026-12-05T18:00:00Z"))).toBe(21);
  });
});

describe("computePace", () => {
  it("começando do zero no meio do mês", () => {
    const p = computePace({ currentCents: 0, targetCents: TARGET, period: NOV, now: NOV12_15H });
    expect(p.bdTotal).toBe(21);
    expect(p.bdElapsed).toBe(9);
    expect(p.bdLeft).toBe(12);
    expect(p.remainingCents).toBe(1_000_000);
    expect(p.paceNeededCents).toBe(83_334); // ceil(1.000.000 / 12)
    expect(p.paceCurrentCents).toBe(0);
    expect(p.onTrack).toBe(false);
    expect(p.projectionCents).toBe(0);
    expect(p.etaDate).toBeNull();
    expect(p.expectedPct).toBeCloseTo(9 / 21);
    expect(p.summary).toBe("Abaixo do ritmo. Faltam R$ 10.000 em 12 dias úteis — R$ 834/dia.");
  });

  it("no ritmo, com projeção e data prevista", () => {
    const p = computePace({ currentCents: 600_000, targetCents: TARGET, period: NOV, now: NOV12_15H });
    expect(p.pct).toBeCloseTo(0.6);
    expect(p.paceCurrentCents).toBe(66_666); // floor(600.000 / 9)
    expect(p.paceNeededCents).toBe(33_334); // ceil(400.000 / 12)
    expect(p.onTrack).toBe(true);
    expect(p.projectionCents).toBe(1_400_000); // 600.000 × 21 / 9
    expect(p.etaDate).toBe("2026-11-23"); // 7 dias úteis depois de 12/11
    expect(p.summary).toBe("No ritmo. Projeção: R$ 14.000 (+R$ 4.000 acima do marco).");
  });

  it("de manhã o dia de hoje ainda está em jogo (mais dias restantes)", () => {
    const p = computePace({ currentCents: 0, targetCents: TARGET, period: NOV, now: NOV12_10H });
    expect(p.bdLeft).toBe(13);
    expect(p.paceNeededCents).toBe(76_924); // ceil(1.000.000 / 13)
  });

  it("marco já batido", () => {
    const p = computePace({ currentCents: 1_200_000, targetCents: TARGET, period: NOV, now: NOV12_15H });
    expect(p.achieved).toBe(true);
    expect(p.pct).toBeCloseTo(1.2);
    expect(p.remainingCents).toBe(0);
    expect(p.paceNeededCents).toBe(0);
    expect(p.onTrack).toBe(true);
    expect(p.etaDate).toBeNull();
    expect(p.summary).toBe("Marco batido.");
  });

  it("meta zero não divide por zero", () => {
    const p = computePace({ currentCents: 5_000, targetCents: 0, period: NOV, now: NOV12_15H });
    expect(p.achieved).toBe(true);
    expect(p.pct).toBe(0);
    expect(p.remainingCents).toBe(0);
    expect(Number.isFinite(p.paceNeededCents)).toBe(true);
  });

  it("virada de mês: último dia às 23h e depois do fim nunca dão bdLeft 0", () => {
    const lastNight = computePace({ currentCents: 900_000, targetCents: TARGET, period: NOV, now: at("2026-12-01T02:00:00Z") });
    expect(lastNight.bdElapsed).toBe(21);
    expect(lastNight.bdLeft).toBe(1);
    expect(lastNight.paceNeededCents).toBe(100_000);
    expect(lastNight.summary).toBe("Abaixo do ritmo. Faltam R$ 1.000 em 1 dia útil — R$ 1.000/dia.");

    const after = computePace({ currentCents: 900_000, targetCents: TARGET, period: NOV, now: at("2026-12-01T03:00:00Z") });
    expect(after.bdElapsed).toBe(21);
    expect(after.bdLeft).toBe(1);
  });

  it("no primeiro dia útil antes do meio-dia o ritmo atual usa divisor 1", () => {
    const p = computePace({ currentCents: 150_000, targetCents: TARGET, period: NOV, now: at("2026-11-02T12:00:00Z") });
    expect(p.bdElapsed).toBe(0);
    expect(p.paceCurrentCents).toBe(150_000);
  });

  it("feriado reduz os dias úteis do mês", () => {
    const p = computePace({
      currentCents: 0, targetCents: TARGET, period: NOV, now: NOV12_15H,
      calendar: { holidays: ["2026-11-20"] },
    });
    expect(p.bdTotal).toBe(20);
    expect(p.bdLeft).toBe(11);
  });
});

describe("resolvePeriod", () => {
  it("datas nulas = mês corrente (marco mensal recorrente)", () => {
    expect(resolvePeriod(null, null, "2026-11-12")).toEqual(NOV);
    expect(resolvePeriod(null, null, "2026-12-03")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
  it("datas explícitas são respeitadas", () => {
    expect(resolvePeriod("2026-11-01", "2026-11-30", "2027-01-10")).toEqual(NOV);
  });
});
