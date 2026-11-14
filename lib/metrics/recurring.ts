/**
 * Lançamentos recorrentes (ARCHITECTURE §4.2): cada regra gera, no dia do mês, um lançamento
 * `pending_review` (aluguel, assinatura, mensalidade de cliente). Puro, testável.
 */
import { endOfMonth, type ISODate } from "@/lib/dates";

export interface RecurringRuleLite {
  id: string;
  day_of_month: number;
  active: boolean;
  /** Último dia em que já gerou (evita duplicar). */
  last_generated_on: ISODate | null;
}

/** Dia de vencimento no mês de `ref`: 29–31 em mês mais curto vira o último dia. */
export function dueDateInMonth(dayOfMonth: number, ref: ISODate): ISODate {
  const last = endOfMonth(ref);
  const day = Math.min(Math.max(Math.trunc(dayOfMonth), 1), Number(last.slice(8, 10)));
  return `${ref.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

/**
 * Regras que precisam gerar hoje: ativas, já venceram neste mês (inclusive hoje) e ainda não
 * geraram este vencimento. Se a rotina falhar um dia, gera no seguinte (só o mês corrente;
 * meses antigos não são recriados).
 */
export function rulesDue<T extends RecurringRuleLite>(rules: readonly T[], today: ISODate): { rule: T; dueOn: ISODate }[] {
  const out: { rule: T; dueOn: ISODate }[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    const dueOn = dueDateInMonth(rule.day_of_month, today);
    if (dueOn > today) continue;
    if (rule.last_generated_on && rule.last_generated_on >= dueOn) continue;
    out.push({ rule, dueOn });
  }
  return out;
}

/**
 * Ao criar uma regra cujo dia já passou neste mês, considera este mês resolvido (você
 * provavelmente já lançou na mão) e começa no próximo. Dia de hoje ou futuro: gera neste mês.
 */
export function initialLastGenerated(dayOfMonth: number, today: ISODate): ISODate | null {
  const dueOn = dueDateInMonth(dayOfMonth, today);
  return dueOn < today ? dueOn : null;
}

/** Chave de idempotência do lançamento gerado (`transactions.external_id` é único por usuário). */
export function recurringExternalId(ruleId: string, dueOn: ISODate): string {
  return `recurring:${ruleId}:${dueOn.slice(0, 7)}`;
}
