import { describe, expect, it } from "vitest";
import {
  businessDaysBetween,
  businessDaysInMonth,
  isBusinessDay,
  nextBusinessDay,
} from "@/lib/metrics/business-days";

describe("business-days", () => {
  it("fim de semana não é dia útil", () => {
    expect(isBusinessDay("2026-11-12")).toBe(true); // quinta
    expect(isBusinessDay("2026-11-14")).toBe(false); // sábado
    expect(isBusinessDay("2026-11-15")).toBe(false); // domingo
  });

  it("feriado informado não conta", () => {
    expect(isBusinessDay("2026-11-20", { holidays: ["2026-11-20"] })).toBe(false);
  });

  it("dias úteis do mês", () => {
    expect(businessDaysInMonth("2026-11-12")).toBe(21); // começa num domingo, termina numa segunda
    expect(businessDaysInMonth("2026-02-01")).toBe(20);
    expect(businessDaysInMonth("2026-11-12", { holidays: ["2026-11-02", "2026-11-20"] })).toBe(19);
  });

  it("intervalo inclusivo", () => {
    expect(businessDaysBetween("2026-11-09", "2026-11-13")).toBe(5);
    expect(businessDaysBetween("2026-11-14", "2026-11-15")).toBe(0);
    expect(businessDaysBetween("2026-11-12", "2026-11-12")).toBe(1);
    expect(businessDaysBetween("2026-11-13", "2026-11-12")).toBe(0);
  });

  it("virada de mês", () => {
    expect(businessDaysBetween("2026-11-30", "2026-12-04")).toBe(5);
  });

  it("workdays customizados (seg–sáb)", () => {
    expect(businessDaysBetween("2026-11-09", "2026-11-15", { workdays: [1, 2, 3, 4, 5, 6] })).toBe(6);
  });

  it("próximo dia útil pula fim de semana e feriado", () => {
    expect(nextBusinessDay("2026-11-13")).toBe("2026-11-16");
    expect(nextBusinessDay("2026-11-19", { holidays: ["2026-11-20"] })).toBe("2026-11-23");
  });
});
