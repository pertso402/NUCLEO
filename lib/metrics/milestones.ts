/**
 * Regras puras dos marcos (tela Marcos, Fase 1.8): período escolhido no formulário,
 * duração de uma conquista e reordenação da fila. Sem banco.
 */
import { addMonths, diffDays, endOfMonth, startOfMonth, todayISO, type ISODate } from "@/lib/dates";
import type { MilestoneMetric } from "./milestone-value";

/** Métricas medidas mês a mês (o período é um mês, ou todo mês). */
export function isMonthlyMetric(metric: MilestoneMetric): boolean {
  return metric === "revenue_month" || metric === "net_month";
}

export interface PeriodFields {
  period_start: ISODate | null;
  period_end: ISODate | null;
  deadline: ISODate | null;
}

/**
 * Converte a escolha do formulário em colunas do marco.
 * - Mensais: `"recorrente"` (todo mês: tudo null) ou `"2026-12"` (aquele mês, prazo no último dia).
 * - Acumuladas (receita acumulada, mensalidades): prazo opcional; com prazo, o ritmo conta de `today` até ele.
 */
export function periodFromChoice(
  metric: MilestoneMetric,
  choice: { month?: string | null; deadline?: ISODate | null },
  today: ISODate,
): PeriodFields {
  if (isMonthlyMetric(metric)) {
    if (!choice.month || choice.month === "recorrente") return { period_start: null, period_end: null, deadline: null };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(choice.month)) throw new RangeError(`Mês inválido: ${choice.month}`);
    const start = `${choice.month}-01`;
    const end = endOfMonth(start);
    return { period_start: start, period_end: end, deadline: end };
  }
  if (!choice.deadline) return { period_start: null, period_end: null, deadline: null };
  if (choice.deadline < today) throw new RangeError("Prazo no passado");
  return { period_start: today, period_end: choice.deadline, deadline: choice.deadline };
}

/** Escolha do formulário a partir das colunas (para editar um marco existente). */
export function choiceFromPeriod(
  metric: MilestoneMetric,
  p: PeriodFields,
): { month: string; deadline: ISODate | null } {
  if (isMonthlyMetric(metric)) {
    return { month: p.period_start ? p.period_start.slice(0, 7) : "recorrente", deadline: null };
  }
  return { month: "recorrente", deadline: p.deadline };
}

/** Meses oferecidos no formulário: o atual e os próximos `count - 1`. */
export function monthChoices(today: ISODate, count = 12): ISODate[] {
  return Array.from({ length: count }, (_, i) => addMonths(today, i));
}

/** Texto curto do período: "nov/2026", "todo mês", "até 31/12/2026", "sem prazo". */
export function periodLabel(metric: MilestoneMetric, p: PeriodFields): string {
  const fmt = (iso: ISODate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  if (isMonthlyMetric(metric)) {
    if (!p.period_start) return "todo mês";
    const start = startOfMonth(p.period_start);
    const short = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" })
      .format(new Date(`${start}T00:00:00Z`))
      .replace(".", "");
    return `${short}/${start.slice(0, 4)}`;
  }
  return p.deadline ? `até ${fmt(p.deadline)}` : "sem prazo";
}

/**
 * Quantos dias levou para bater: do início do período (ou da criação do marco) até o dia em que bateu,
 * contando os dois dias (bater no mesmo dia em que começou = 1 dia).
 */
export function achievementDays(m: { period_start: ISODate | null; created_at: string; achieved_at: string }): number {
  const start = m.period_start ?? todayISO(new Date(m.created_at));
  const end = todayISO(new Date(m.achieved_at));
  return Math.max(1, diffDays(start, end) + 1);
}

/** Move `id` uma posição para cima (-1) ou para baixo (+1). Devolve a nova ordem (ou a mesma se não der). */
export function moveInOrder<T>(ids: readonly T[], id: T, dir: -1 | 1): T[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
