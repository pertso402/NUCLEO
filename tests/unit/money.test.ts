import { describe, expect, it } from "vitest";
import { brlParts, centsToInput, formatBRL, formatCompactBRL, parseBRL, ratio, reaisToCents, sumCents, toCents } from "@/lib/money";

describe("parseBRL", () => {
  it.each([
    ["38", 3800],
    ["38,90", 3890],
    ["38,9", 3890],
    ["R$ 1.500", 150000],
    ["r$1.500,50", 150050],
    ["1500.5", 150050],
    ["1.234.567,89", 123456789],
    ["0,01", 1],
    ["2k", 200000],
    ["1,5 mil", 150000],
    ["1.5k", 150000],
    ["-40", -4000],
    ["0,005", 1], // meio centavo arredonda para cima
    ["0,004", 0],
    ["99 reais", 9900],
    ["1 real", 100],
    ["60 conto", 6000],
    ["50 pilas", 5000],
    ["2 mil reais", 200000],
    ["R$ 38,90 reais", 3890],
  ])("%s → %i centavos", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "1.2.3", "1,2,3", "R$", "1,50.3"])("rejeita %j", (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it("não sofre erro de float (0,1 + 0,2)", () => {
    expect(sumCents([parseBRL("0,1")!, parseBRL("0,2")!])).toBe(30);
  });
});

describe("formatBRL", () => {
  it("formata em pt-BR com espaço comum", () => {
    expect(formatBRL(150000)).toBe("R$ 1.500,00");
    expect(formatBRL(1)).toBe("R$ 0,01");
    expect(formatBRL(-4050)).toBe("-R$ 40,50");
  });
  it("omite centavos quando pedido e o valor é redondo", () => {
    expect(formatBRL(1000000, { cents: false })).toBe("R$ 10.000");
    expect(formatBRL(1000050, { cents: false })).toBe("R$ 10.000,50");
  });
  it("recusa não-inteiros", () => {
    expect(() => formatBRL(10.5)).toThrow(RangeError);
  });
});

describe("brlParts", () => {
  it("separa símbolo, inteiro e centavos", () => {
    expect(brlParts(620050)).toEqual({ sign: "", symbol: "R$", integer: "6.200", decimal: "50" });
    expect(brlParts(-5)).toEqual({ sign: "-", symbol: "R$", integer: "0", decimal: "05" });
  });
});

describe("conversões", () => {
  it("toCents aceita bigint do Postgres como string/bigint", () => {
    expect(toCents("150000")).toBe(150000);
    expect(toCents(BigInt(42))).toBe(42);
    expect(toCents(null)).toBe(0);
    expect(() => toCents("12.5")).toThrow(RangeError);
  });
  it("reaisToCents só aceita inteiros", () => {
    expect(reaisToCents(10000)).toBe(1000000);
    expect(() => reaisToCents(1.5)).toThrow(RangeError);
  });
  it("ratio protege meta zero", () => {
    expect(ratio(620000, 1000000)).toBeCloseTo(0.62);
    expect(ratio(100, 0)).toBe(0);
  });
});

describe("centsToInput / formatCompactBRL", () => {
  it("centsToInput é o inverso de parseBRL", () => {
    for (const c of [1, 99, 100, 4090, 150000, 123456789]) {
      expect(parseBRL(centsToInput(c))).toBe(c);
    }
    expect(centsToInput(150000)).toBe("1500,00");
    expect(centsToInput(5)).toBe("0,05");
  });
  it("formatCompactBRL", () => {
    expect(formatCompactBRL(0)).toBe("R$ 0");
    expect(formatCompactBRL(95000)).toBe("R$ 950");
    expect(formatCompactBRL(150000)).toBe("R$ 1,5k");
    expect(formatCompactBRL(1000000)).toBe("R$ 10k");
    expect(formatCompactBRL(1234000)).toBe("R$ 12k");
    expect(formatCompactBRL(120000000)).toBe("R$ 1,2M");
    expect(formatCompactBRL(-200000)).toBe("-R$ 2k");
  });
});
