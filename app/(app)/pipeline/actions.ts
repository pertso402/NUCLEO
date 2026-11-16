"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { LeadEvent } from "@/lib/data/pipeline";
import { parseISODate, todayISO } from "@/lib/dates";
import { isLive, nextBusinessDay, type LeadStage } from "@/lib/metrics/pipeline";
import { parseBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações da tela Pipeline. Sessão do dono (RLS). O banco garante as regras (lead vivo com próxima
 * ação, perdido com motivo); aqui completamos o que faltar com padrões sensatos e mensagens em PT-BR.
 */
export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

type Supa = Awaited<ReturnType<typeof createClient>>;

const id = z.uuid();
const isoDate = z.string().refine((s) => {
  try {
    parseISODate(s);
    return true;
  } catch {
    return false;
  }
});
const STAGE = z.enum(["abordado", "conversou", "reuniao", "proposta", "fechado", "perdido"]);
const LOST = z.enum(["preco", "timing", "sem_resposta", "concorrente", "nao_viu_valor", "outro"]);
const ORIGIN = z.enum(["indicacao", "abordagem_fria", "instagram", "evento", "cliente_atual", "outro"]);

async function authed(): Promise<Supa | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? supabase : null;
}

const NOT_AUTHED = { ok: false, error: "Sessão expirada. Entre de novo." } as const satisfies ActionResult;
const INVALID = { ok: false, error: "Dados inválidos." } as const satisfies ActionResult;

function done(error: { message: string; code?: string } | null, what: string, newId?: string): ActionResult {
  if (error) {
    console.error(`pipeline: ${what}`, error.message);
    if (error.code === "23514") return { ok: false, error: "Lead vivo precisa de próxima ação com data; perdido precisa de motivo." };
    return { ok: false, error: `Não deu para ${what}. Tenta de novo.` };
  }
  revalidatePath("/", "layout");
  return { ok: true, id: newId };
}

/** Valor em reais digitado → centavos; vazio = null; inválido = undefined. */
function money(s: string | null | undefined): number | null | undefined {
  if (!s || !s.trim()) return null;
  const c = parseBRL(s);
  return c !== null && c > 0 ? c : undefined;
}

const LeadFields = z.object({
  name: z.string().trim().min(1, "Dê um nome ao lead.").max(120),
  business: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  segment: z.string().trim().max(60),
  origin: ORIGIN,
  monthly_value: z.string().trim().max(40),
  setup_value: z.string().trim().max(40),
  next_action: z.string().trim().max(200),
  next_action_on: isoDate.nullable(),
  notes: z.string().trim().max(2000),
});
export type LeadFieldsInput = z.input<typeof LeadFields>;

function fieldsRow(f: z.output<typeof LeadFields>, stage: LeadStage) {
  const monthly = money(f.monthly_value);
  const setup = money(f.setup_value);
  if (monthly === undefined || setup === undefined) return null;
  const live = isLive(stage);
  return {
    name: f.name,
    business: f.business || null,
    phone: f.phone || null,
    segment: f.segment || null,
    origin: f.origin,
    monthly_value_cents: monthly,
    setup_value_cents: setup,
    notes: f.notes || null,
    next_action: live ? f.next_action || "Fazer follow-up" : f.next_action || null,
    next_action_on: live ? f.next_action_on ?? nextBusinessDay(todayISO()) : f.next_action_on,
  };
}

export async function createLead(input: LeadFieldsInput & { stage: LeadStage }): Promise<ActionResult> {
  const parsed = LeadFields.safeParse(input);
  const stage = STAGE.safeParse(input.stage);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID.error };
  if (!stage.success || !isLive(stage.data)) return INVALID;
  const row = fieldsRow(parsed.data, stage.data);
  if (!row) return { ok: false, error: "Valor inválido." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { data, error } = await supabase.from("crm_leads").insert({ ...row, stage: stage.data }).select("id").single();
  return done(error, "criar o lead", data?.id as string | undefined);
}

export async function updateLeadFields(leadId: string, stage: LeadStage, input: LeadFieldsInput): Promise<ActionResult> {
  const parsed = LeadFields.safeParse(input);
  if (!id.safeParse(leadId).success || !STAGE.safeParse(stage).success) return INVALID;
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID.error };
  const row = fieldsRow(parsed.data, stage);
  if (!row) return { ok: false, error: "Valor inválido." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("crm_leads").update(row).eq("id", leadId);
  return done(error, "salvar o lead");
}

/**
 * Muda a etapa (arrastar no desktop, "Avançar"/menu no mobile). Perdido exige motivo. Ao voltar
 * para uma etapa viva sem próximo passo, entra "Fazer follow-up" no próximo dia útil.
 */
export async function moveLead(
  leadId: string,
  stage: LeadStage,
  extra: { lost_reason?: string | null; monthly_value?: string | null } = {},
): Promise<ActionResult> {
  if (!id.safeParse(leadId).success || !STAGE.safeParse(stage).success) return INVALID;
  const lost = extra.lost_reason ? LOST.safeParse(extra.lost_reason) : null;
  if (stage === "perdido" && !lost?.success) return { ok: false, error: "Diga por que não fechou." };
  const monthly = money(extra.monthly_value);
  if (monthly === undefined) return { ok: false, error: "Mensalidade inválida." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;

  const { data: cur, error: readErr } = await supabase
    .from("crm_leads")
    .select("next_action, next_action_on")
    .eq("id", leadId)
    .maybeSingle();
  if (readErr || !cur) return { ok: false, error: "Lead não encontrado." };

  const patch: Record<string, unknown> = { stage };
  if (stage === "perdido" && lost?.success) patch.lost_reason = lost.data;
  if (monthly) patch.monthly_value_cents = monthly;
  if (isLive(stage)) {
    const today = todayISO();
    if (!cur.next_action) patch.next_action = "Fazer follow-up";
    if (!cur.next_action_on || String(cur.next_action_on) < today) patch.next_action_on = nextBusinessDay(today);
  } else {
    patch.next_action = null;
    patch.next_action_on = null;
  }
  const { error } = await supabase.from("crm_leads").update(patch).eq("id", leadId);
  return done(error, "mudar a etapa");
}

/** Contrato do cliente fechado: ativo entra no MRR; encerrado sai. */
export async function setContractStatus(leadId: string, status: "ativo" | "encerrado"): Promise<ActionResult> {
  if (!id.safeParse(leadId).success || !["ativo", "encerrado"].includes(status)) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("crm_leads").update({ contract_status: status }).eq("id", leadId).eq("stage", "fechado");
  return done(error, "mudar o contrato");
}

export async function addLeadNote(leadId: string, text: string): Promise<ActionResult> {
  const t = z.string().trim().min(1).max(1000).safeParse(text);
  if (!id.safeParse(leadId).success || !t.success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("crm_lead_events").insert({ lead_id: leadId, type: "note", payload: { text: t.data } });
  return done(error, "salvar a nota");
}

/** Marca o follow-up de hoje como feito e já agenda o próximo passo. */
export async function completeFollowup(leadId: string, nextAction: string, nextOn: string): Promise<ActionResult> {
  const a = z.string().trim().min(1).max(200).safeParse(nextAction);
  if (!id.safeParse(leadId).success || !a.success || !isoDate.safeParse(nextOn).success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { data: cur } = await supabase.from("crm_leads").select("next_action").eq("id", leadId).maybeSingle();
  const { error: evErr } = await supabase
    .from("crm_lead_events")
    .insert({ lead_id: leadId, type: "followup_done", payload: { action: cur?.next_action ?? null } });
  if (evErr) return done(evErr, "registrar o follow-up");
  const { error } = await supabase.from("crm_leads").update({ next_action: a.data, next_action_on: nextOn }).eq("id", leadId);
  return done(error, "agendar o próximo passo");
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  if (!id.safeParse(leadId).success) return INVALID;
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { error } = await supabase.from("crm_leads").delete().eq("id", leadId);
  return done(error, "excluir o lead");
}

/** Histórico do lead (mais recentes primeiro). Leitura — usada pelo detalhe. */
export async function loadLeadEvents(leadId: string): Promise<LeadEvent[]> {
  if (!id.safeParse(leadId).success) return [];
  const supabase = await authed();
  if (!supabase) return [];
  const { data } = await supabase
    .from("crm_lead_events")
    .select("id, type, from_stage, to_stage, payload, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as LeadEvent[];
}

/** Ticket médio padrão (usado pelo funil enquanto não há contratos fechados com valor). */
export async function setDefaultTicket(value: string): Promise<ActionResult> {
  const cents = money(value);
  if (!cents) return { ok: false, error: "Informe um valor por mês (ex.: 900)." };
  const supabase = await authed();
  if (!supabase) return NOT_AUTHED;
  const { data } = await supabase.auth.getClaims();
  const { error } = await supabase.from("settings").update({ default_ticket_cents: cents }).eq("user_id", data?.claims?.sub ?? "");
  return done(error, "salvar o ticket médio");
}
