import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/dates";
import { recurringExternalId, rulesDue } from "@/lib/metrics/recurring";

export interface RecurringRule {
  id: string;
  description: string;
  amount_cents: number;
  kind: "income" | "expense";
  category_id: string | null;
  day_of_month: number;
  active: boolean;
  lead_id: string | null;
  last_generated_on: string | null;
}

export const RULE_COLS = "id, description, amount_cents, kind, category_id, day_of_month, active, lead_id, last_generated_on";

/**
 * Gera os lançamentos `pending_review` das regras que venceram (Vercel Cron diário).
 * Idempotente: `external_id = recurring:<regra>:<mês>` é único, então rodar duas vezes não duplica.
 * `dry`: só diz o que geraria.
 */
export async function generateRecurring(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  opts: { dry?: boolean } = {},
): Promise<{ created: { description: string; dueOn: string }[]; already: number }> {
  const today = todayISO(now);
  const { data, error } = await supabase.from("recurring_rules").select(RULE_COLS).eq("user_id", userId).eq("active", true);
  if (error) throw new Error(`Falha ao ler recorrentes: ${error.message}`);
  const due = rulesDue((data ?? []) as RecurringRule[], today);

  const created: { description: string; dueOn: string }[] = [];
  let already = 0;
  for (const { rule, dueOn } of due) {
    if (opts.dry) {
      created.push({ description: rule.description, dueOn });
      continue;
    }
    const { error: insErr } = await supabase.from("transactions").insert({
      user_id: userId,
      occurred_on: dueOn,
      amount_cents: rule.amount_cents,
      kind: rule.kind,
      category_id: rule.category_id,
      description: rule.description,
      lead_id: rule.lead_id,
      source: "app",
      status: "pending_review",
      external_id: recurringExternalId(rule.id, dueOn),
    });
    if (insErr && insErr.code !== "23505") throw new Error(`Falha ao gerar "${rule.description}": ${insErr.message}`);
    if (insErr) already++;
    else created.push({ description: rule.description, dueOn });

    const { error: upErr } = await supabase
      .from("recurring_rules")
      .update({ last_generated_on: dueOn })
      .eq("id", rule.id)
      .eq("user_id", userId);
    if (upErr) console.error("recorrentes: falha ao marcar gerado", upErr.message);
  }
  return { created, already };
}
