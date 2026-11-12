/**
 * Dinheiro no NÚCLEO: sempre CENTAVOS INTEIROS.
 * No banco é `bigint`; em JS usamos `number` inteiro (seguro até ~R$ 90 trilhões).
 * Nunca operar com reais fracionários; formatação só na UI.
 */

export type Cents = number;

const MAX = Number.MAX_SAFE_INTEGER;

export function assertCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Valor em centavos inválido: ${value}`);
  }
  return value;
}

/** Converte o que vem do Postgres (`bigint` chega como string ou number) em centavos. */
export function toCents(value: string | number | bigint | null | undefined): Cents {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") {
    if (value > BigInt(MAX) || value < BigInt(-MAX)) throw new RangeError("bigint fora do intervalo seguro");
    return Number(value);
  }
  if (typeof value === "string") {
    if (!/^-?\d+$/.test(value.trim())) throw new RangeError(`bigint inválido: ${value}`);
    return assertCents(Number(value.trim()));
  }
  return assertCents(value);
}

/**
 * Lê um valor em reais escrito em pt-BR e devolve centavos (sem passar por float).
 * Aceita: "38", "38,90", "R$ 1.500", "1.500,50", "1500.5", "2k", "1,5 mil", "-40".
 * Ponto seguido de exatamente 3 dígitos é separador de milhar ("1.500" = mil e quinhentos).
 * Retorna null se não houver número reconhecível.
 */
export function parseBRL(input: string): Cents | null {
  let s = input.toLowerCase().replace(/r\$/g, "").replace(/\s+/g, " ").trim();
  if (!s) return null;

  let multiplier = 1;
  const suffix = s.match(/^(.*?)\s*(k|mil)$/);
  if (suffix?.[1] !== undefined) {
    multiplier = 1000;
    s = suffix[1].trim();
  }

  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  let intPart: string;
  let fracPart = "";

  const lastComma = s.lastIndexOf(",");
  if (lastComma >= 0) {
    // Vírgula = decimal; pontos antes dela = milhar.
    intPart = s.slice(0, lastComma).replace(/\./g, "");
    fracPart = s.slice(lastComma + 1);
    if (fracPart.includes(".")) return null;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    intPart = s.replace(/\./g, "");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) return null;
    intPart = parts[0] ?? "";
    fracPart = parts[1] ?? "";
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  if (!intPart && !fracPart) return null;

  // Tudo em inteiros: escala para "milésimos de centavo" o suficiente p/ o multiplicador.
  const fracDigits = fracPart.length;
  const scaled = BigInt((intPart || "0") + fracPart) * BigInt(100) * BigInt(multiplier);
  const divisor = BigInt(10) ** BigInt(fracDigits);
  // Arredonda meio-para-cima nos centavos.
  let cents = scaled / divisor;
  if ((scaled % divisor) * BigInt(2) >= divisor) cents += BigInt(1);

  const n = toCents(cents);
  return negative ? -n : n;
}

/** Reais inteiros → centavos (ex.: metas digitadas em reais). */
export function reaisToCents(reais: number): Cents {
  if (!Number.isSafeInteger(reais)) throw new RangeError("Use parseBRL para valores com centavos");
  return assertCents(reais * 100);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlNoCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "R$ 1.500,00" (o espaço do Intl é normalizado para espaço comum). */
export function formatBRL(cents: Cents, opts: { cents?: boolean } = {}): string {
  assertCents(cents);
  const showCents = opts.cents ?? true;
  if (!showCents && cents % 100 === 0) {
    return brlNoCents.format(cents / 100).replace(/ /g, " ");
  }
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** Partes para a UI: "R$" menor, inteiro em destaque, centavos apagados (DESIGN §3). */
export function brlParts(cents: Cents): { sign: "" | "-"; symbol: "R$"; integer: string; decimal: string } {
  assertCents(cents);
  const abs = Math.abs(cents);
  const integer = new Intl.NumberFormat("pt-BR").format(Math.floor(abs / 100));
  const decimal = String(abs % 100).padStart(2, "0");
  return { sign: cents < 0 ? "-" : "", symbol: "R$", integer, decimal };
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total = assertCents(total + assertCents(v));
  return total;
}

/** Fração current/target (0 quando target <= 0). Uso: percentuais de marco na UI. */
export function ratio(current: Cents, target: Cents): number {
  if (target <= 0) return 0;
  return current / target;
}
