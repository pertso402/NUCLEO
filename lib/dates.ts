/**
 * Datas no NÚCLEO: tudo em America/Sao_Paulo.
 * Datas de calendário são strings ISO "YYYY-MM-DD" (sem hora, sem fuso) — evita
 * o clássico bug de "virou o dia em UTC às 21h". Instantes são `Date`.
 */

export const TZ = "America/Sao_Paulo";

export type ISODate = string; // "YYYY-MM-DD"

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Componentes do instante no fuso de São Paulo. */
export function zonedParts(instant: Date = new Date()): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(instant)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseISODate(iso: ISODate): { year: number; month: number; day: number } {
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError(`Data inválida: ${iso}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Data inexistente: ${iso}`);
  }
  return { year, month, day };
}

/** "Hoje" em São Paulo. */
export function todayISO(now: Date = new Date()): ISODate {
  const p = zonedParts(now);
  return toISODate(p.year, p.month, p.day);
}

/** Hora local (0–23) em São Paulo. */
export function hourInSP(now: Date = new Date()): number {
  return zonedParts(now).hour;
}

// Aritmética de calendário via UTC puro (sem fuso envolvido).
function isoToUTC(iso: ISODate): Date {
  const { year, month, day } = parseISODate(iso);
  return new Date(Date.UTC(year, month - 1, day));
}
function utcToISO(d: Date): ISODate {
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = isoToUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToISO(d);
}

/** Dia da semana: 0 = domingo … 6 = sábado (mesma convenção de `settings.workdays`). */
export function weekday(iso: ISODate): number {
  return isoToUTC(iso).getUTCDay();
}

/** Diferença em dias de calendário (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((isoToUTC(b).getTime() - isoToUTC(a).getTime()) / 86_400_000);
}

export function startOfMonth(iso: ISODate): ISODate {
  const { year, month } = parseISODate(iso);
  return toISODate(year, month, 1);
}

export function endOfMonth(iso: ISODate): ISODate {
  const { year, month } = parseISODate(iso);
  return utcToISO(new Date(Date.UTC(year, month, 0)));
}

export function monthRange(iso: ISODate): { start: ISODate; end: ISODate } {
  return { start: startOfMonth(iso), end: endOfMonth(iso) };
}

/** Segunda-feira da semana da data (semana seg–dom, para revisão semanal). */
export function startOfWeek(iso: ISODate): ISODate {
  const wd = weekday(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/** "2026-11" — chave de mês. */
export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

/**
 * Instante (UTC) da meia-noite de uma data em São Paulo.
 * Útil para filtrar colunas `timestamptz` por dia local.
 * Calcula o offset real do fuso naquele dia (robusto se o horário de verão voltar).
 */
export function startOfDayInstant(iso: ISODate): Date {
  const { year, month, day } = parseISODate(iso);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const p = zonedParts(new Date(guess));
  const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = asIfUTC - guess; // ms que SP está à frente (negativo: -3h)
  return new Date(guess - offset);
}

/** Intervalo [início, fim) de um dia local em instantes UTC. */
export function dayInstantRange(iso: ISODate): { from: Date; to: Date } {
  return { from: startOfDayInstant(iso), to: startOfDayInstant(addDays(iso, 1)) };
}

const shortFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const longFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "12/11" */
export function formatShortDate(iso: ISODate): string {
  return shortFmt.format(isoToUTC(iso));
}

/** "quinta-feira, 12 de novembro" */
export function formatLongDate(iso: ISODate): string {
  return longFmt.format(isoToUTC(iso));
}
