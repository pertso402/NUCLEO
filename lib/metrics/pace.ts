/**
 * Ritmo do marco (ARCHITECTURE §6.1). Função pura: recebe números e datas, devolve
 * quanto falta, quanto precisa por dia útil, o ritmo atual e a projeção.
 * Tudo em centavos inteiros; "hoje" é sempre o dia em São Paulo.
 */
import { formatBRL, type Cents } from "@/lib/money";
import { addDays, hourInSP, monthRange, todayISO, type ISODate } from "@/lib/dates";
import {
  businessDaysBetween,
  isBusinessDay,
  nextBusinessDay,
  type BusinessDayOptions,
} from "@/lib/metrics/business-days";

export interface Period {
  start: ISODate;
  end: ISODate;
}

export interface PaceInput {
  currentCents: Cents;
  targetCents: Cents;
  period: Period;
  now?: Date;
  calendar?: BusinessDayOptions;
}

export interface PaceResult {
  currentCents: Cents;
  targetCents: Cents;
  remainingCents: Cents;
  /** current / target (0 se meta <= 0). Pode passar de 1. */
  pct: number;
  achieved: boolean;
  bdTotal: number;
  bdElapsed: number;
  /** Dias úteis restantes, mínimo 1. */
  bdLeft: number;
  /** Centavos por dia útil necessários (arredondado para cima). */
  paceNeededCents: Cents;
  /** Centavos por dia útil no ritmo atual (arredondado para baixo). */
  paceCurrentCents: Cents;
  onTrack: boolean;
  /** Valor projetado no fim do período mantendo o ritmo atual. */
  projectionCents: Cents;
  /** Dia útil em que bate o marco no ritmo atual; null se já bateu ou se o ritmo é zero. */
  etaDate: ISODate | null;
  /** Fração do período (em dias úteis) que já passou: "onde deveria estar hoje". */
  expectedPct: number;
  summary: string;
}

/** Período do marco: datas explícitas, ou o mês corrente quando são nulas (marco mensal recorrente). */
export function resolvePeriod(
  periodStart: ISODate | null | undefined,
  periodEnd: ISODate | null | undefined,
  today: ISODate,
): Period {
  const month = monthRange(today);
  return { start: periodStart ?? month.start, end: periodEnd ?? month.end };
}

/**
 * Dias úteis decorridos no período até agora.
 * Hoje só conta como decorrido depois das 12h (em São Paulo) — de manhã o dia ainda está "em jogo".
 */
export function businessDaysElapsed(period: Period, now: Date, calendar: BusinessDayOptions = {}): number {
  const today = todayISO(now);
  if (today < period.start) return 0;
  if (today > period.end) return businessDaysBetween(period.start, period.end, calendar);
  const beforeToday = businessDaysBetween(period.start, addDays(today, -1), calendar);
  const todayCounts = isBusinessDay(today, calendar) && hourInSP(now) >= 12;
  return beforeToday + (todayCounts ? 1 : 0);
}

function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

function formatReais(cents: Cents): string {
  // Mensagens de ritmo em reais cheios (arredonda para cima: nunca subestima o que falta).
  return formatBRL(Math.ceil(cents / 100) * 100, { cents: false });
}

export function computePace(input: PaceInput): PaceResult {
  const now = input.now ?? new Date();
  const calendar = input.calendar ?? {};
  const { currentCents, targetCents, period } = input;
  const today = todayISO(now);

  const bdTotal = businessDaysBetween(period.start, period.end, calendar);
  const bdElapsed = businessDaysElapsed(period, now, calendar);
  const bdLeft = Math.max(bdTotal - bdElapsed, 1);

  const achieved = targetCents <= 0 || currentCents >= targetCents;
  const remainingCents = Math.max(targetCents - currentCents, 0);
  const pct = targetCents > 0 ? currentCents / targetCents : 0;

  const paceNeededCents = remainingCents === 0 ? 0 : ceilDiv(remainingCents, bdLeft);
  const paceCurrentCents = Math.floor(currentCents / Math.max(bdElapsed, 1));
  const onTrack = achieved || paceCurrentCents >= paceNeededCents;

  // current / max(bdElapsed,1) * bdTotal, numa conta só para não acumular arredondamento.
  const projectionCents = Math.floor((currentCents * bdTotal) / Math.max(bdElapsed, 1));

  let etaDate: ISODate | null = null;
  if (!achieved && paceCurrentCents > 0) {
    const daysNeeded = ceilDiv(remainingCents, paceCurrentCents);
    let d = today;
    for (let i = 0; i < daysNeeded; i++) d = nextBusinessDay(d, calendar);
    etaDate = d;
  }

  const expectedPct = bdTotal > 0 ? Math.min(bdElapsed / bdTotal, 1) : 0;

  let summary: string;
  if (achieved) {
    summary = "Marco batido.";
  } else if (onTrack) {
    const above = Math.max(projectionCents - targetCents, 0);
    summary = `No ritmo. Projeção: ${formatReais(projectionCents)} (+${formatReais(above)} acima do marco).`;
  } else {
    const days = bdLeft === 1 ? "1 dia útil" : `${bdLeft} dias úteis`;
    summary = `Abaixo do ritmo. Faltam ${formatReais(remainingCents)} em ${days} — ${formatReais(paceNeededCents)}/dia.`;
  }

  return {
    currentCents,
    targetCents,
    remainingCents,
    pct,
    achieved,
    bdTotal,
    bdElapsed,
    bdLeft,
    paceNeededCents,
    paceCurrentCents,
    onTrack,
    projectionCents,
    etaDate,
    expectedPct,
    summary,
  };
}
