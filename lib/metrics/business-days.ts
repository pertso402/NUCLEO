import { addDays, diffDays, monthRange, weekday, type ISODate } from "@/lib/dates";

/** Padrão de `settings.workdays`: seg–sex (0 = domingo). */
export const DEFAULT_WORKDAYS: readonly number[] = [1, 2, 3, 4, 5];

export interface BusinessDayOptions {
  workdays?: readonly number[];
  /** Feriados (ISO). Fase 5 popula a partir da tabela `holidays`. */
  holidays?: readonly ISODate[];
}

export function isBusinessDay(iso: ISODate, opts: BusinessDayOptions = {}): boolean {
  const workdays = opts.workdays ?? DEFAULT_WORKDAYS;
  if (!workdays.includes(weekday(iso))) return false;
  return !(opts.holidays ?? []).includes(iso);
}

/** Dias úteis entre `from` e `to`, ambos INCLUSIVOS. 0 se `to` < `from`. */
export function businessDaysBetween(from: ISODate, to: ISODate, opts: BusinessDayOptions = {}): number {
  const span = diffDays(from, to);
  if (span < 0) return 0;
  const holidays = new Set(opts.holidays ?? []);
  const workdays = opts.workdays ?? DEFAULT_WORKDAYS;
  let count = 0;
  for (let i = 0; i <= span; i++) {
    const d = addDays(from, i);
    if (workdays.includes(weekday(d)) && !holidays.has(d)) count++;
  }
  return count;
}

/** Dias úteis do mês da data. */
export function businessDaysInMonth(iso: ISODate, opts: BusinessDayOptions = {}): number {
  const { start, end } = monthRange(iso);
  return businessDaysBetween(start, end, opts);
}

/** Próximo dia útil estritamente depois de `iso`. */
export function nextBusinessDay(iso: ISODate, opts: BusinessDayOptions = {}): ISODate {
  let d = addDays(iso, 1);
  for (let guard = 0; guard < 366; guard++) {
    if (isBusinessDay(d, opts)) return d;
    d = addDays(d, 1);
  }
  throw new RangeError("Nenhum dia útil em 1 ano — confira workdays/holidays");
}
