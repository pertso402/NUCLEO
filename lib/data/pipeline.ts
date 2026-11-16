import "server-only";
import { addDays, todayISO } from "@/lib/dates";
import type { BoardLead, LeadOrigin, LostReason } from "@/lib/metrics/pipeline";
import { toCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export interface Lead extends BoardLead {
  phone: string | null;
  segment: string | null;
  origin: LeadOrigin;
  setup_value_cents: number | null;
  lost_reason: LostReason | null;
  contract_status: "ativo" | "encerrado" | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeadEvent {
  id: string;
  type: "stage_change" | "note" | "contact" | "followup_done";
  from_stage: string | null;
  to_stage: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export const LEAD_COLS =
  "id, name, business, phone, segment, origin, stage, monthly_value_cents, setup_value_cents, next_action, next_action_on, lost_reason, contract_status, stage_changed_at, closed_at, notes, created_at";

export function toLead(r: Record<string, unknown>): Lead {
  return {
    ...(r as unknown as Lead),
    monthly_value_cents: r.monthly_value_cents === null ? null : toCents(r.monthly_value_cents as number),
    setup_value_cents: r.setup_value_cents === null ? null : toCents(r.setup_value_cents as number),
  };
}

/**
 * Leads do quadro: todos os vivos e fechados; perdidos só dos últimos 60 dias (o histórico
 * completo fica nos eventos e nas análises da 3.7).
 */
export async function loadBoard(now = new Date()): Promise<Lead[]> {
  const supabase = await createClient();
  const cutoff = `${addDays(todayISO(now), -60)}T00:00:00Z`;
  const { data, error } = await supabase
    .from("crm_leads")
    .select(LEAD_COLS)
    .or(`stage.neq.perdido,stage_changed_at.gte.${cutoff}`)
    .order("next_action_on", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(`Falha ao ler o pipeline: ${error.message}`);
  return (data ?? []).map(toLead);
}
