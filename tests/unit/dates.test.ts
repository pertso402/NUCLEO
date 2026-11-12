import { describe, expect, it } from "vitest";
import {
  addDays,
  dayInstantRange,
  diffDays,
  endOfMonth,
  formatShortDate,
  hourInSP,
  monthKey,
  monthRange,
  parseISODate,
  startOfDayInstant,
  startOfWeek,
  todayISO,
  weekday,
} from "@/lib/dates";

describe("todayISO em São Paulo (testes rodam com TZ=UTC)", () => {
  it("23:30 em SP ainda é o mesmo dia, embora já seja amanhã em UTC", () => {
    // 2026-11-13T02:30Z = 2026-11-12 23:30 em SP (UTC-3)
    expect(todayISO(new Date("2026-11-13T02:30:00Z"))).toBe("2026-11-12");
  });
  it("vira o dia à meia-noite de SP (03:00Z)", () => {
    expect(todayISO(new Date("2026-11-13T02:59:59Z"))).toBe("2026-11-12");
    expect(todayISO(new Date("2026-11-13T03:00:00Z"))).toBe("2026-11-13");
  });
  it("virada de mês e de ano em SP", () => {
    expect(todayISO(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11-30");
    expect(todayISO(new Date("2027-01-01T02:59:00Z"))).toBe("2026-12-31");
    expect(todayISO(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });
  it("hourInSP", () => {
    expect(hourInSP(new Date("2026-11-12T15:00:00Z"))).toBe(12);
    expect(hourInSP(new Date("2026-11-13T02:30:00Z"))).toBe(23);
  });
});

describe("aritmética de calendário", () => {
  it("addDays atravessa mês, ano e 29/02", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("weekday: 0 = domingo", () => {
    expect(weekday("2026-11-01")).toBe(0);
    expect(weekday("2026-11-12")).toBe(4);
    expect(weekday("2028-02-29")).toBe(2);
  });
  it("diffDays", () => {
    expect(diffDays("2026-11-01", "2026-11-30")).toBe(29);
    expect(diffDays("2026-11-30", "2026-11-01")).toBe(-29);
  });
  it("limites de mês", () => {
    expect(monthRange("2026-11-12")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(monthKey("2026-11-12")).toBe("2026-11");
  });
  it("startOfWeek = segunda-feira", () => {
    expect(startOfWeek("2026-11-12")).toBe("2026-11-09");
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09");
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // domingo
  });
  it("rejeita datas inválidas", () => {
    expect(() => parseISODate("2026-02-30")).toThrow(RangeError);
    expect(() => parseISODate("12/11/2026")).toThrow(RangeError);
  });
});

describe("instantes de um dia local", () => {
  it("meia-noite de SP = 03:00Z", () => {
    expect(startOfDayInstant("2026-11-12").toISOString()).toBe("2026-11-12T03:00:00.000Z");
  });
  it("dayInstantRange cobre 24h", () => {
    const { from, to } = dayInstantRange("2026-11-30");
    expect(from.toISOString()).toBe("2026-11-30T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
});

describe("formatação", () => {
  it("formatShortDate não sofre deslocamento de fuso", () => {
    expect(formatShortDate("2026-11-01")).toBe("01/11");
  });
});
