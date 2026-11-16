import "server-only";
import { countOutreach } from "@/lib/data/outreach";
import { todayISO } from "@/lib/dates";
import { nextBusinessDay } from "@/lib/metrics/pipeline";
import { formatBRL, parseBRL } from "@/lib/money";
import { matchByName } from "./match";
import { dayLabel } from "./routine";
import type { ActionOutcome, ExecContext, LeadLite } from "./executor";
import type { ToolCall } from "./tools";

/**
 * Ferramentas do pipeline (Fase 3.2): criar/atualizar lead e registrar abordagens.
 * Client admin: SEMPRE grava/filtra com `ctx.userId`. Toda alteração guarda o estado anterior.
 */

type Args<N extends ToolCall["name"]> = Extract<ToolCall, { name: N }>["args"];

export const STAGE_LABEL: Record<LeadLite["stage"], string> = {
  abordado: "abordado",
  conversou: "conversou",
  reuniao: "reunião",
  proposta: "proposta",
  fechado: "fechado",
  perdido: "perdido",
};

const LOST_LABEL: Record<string, string> = {
  preco: "preço",
  timing: "timing",
  sem_resposta: "sem resposta",
  concorrente: "concorrente",
  nao_viu_valor: "não viu valor",
  outro: "outro",
};

const LIVE = (s: LeadLite["stage"]) => s !== "fechado" && s !== "perdido";

export const leadLabel = (l: Pick<LeadLite, "name" | "business">) => (l.business ? `${l.name} (${l.business})` : l.name);

export { nextBusinessDay };

/** Abordagens de hoje = leads criados hoje em "abordado" + abordagens registradas em lote (ARCHITECTURE §4.5). */
export async function outreachToday(ctx: ExecContext): Promise<number> {
  return countOutreach(ctx.supabase, ctx.userId, todayISO(ctx.now));
}

export async function createLead(args: Args<"create_lead">, ctx: ExecContext): Promise<ActionOutcome> {
  const today = todayISO(ctx.now);
  const exists = matchByName(ctx.routine.leads, args.business ?? args.name, (l) => `${l.name} ${l.business ?? ""}`);
  if (exists && "item" in exists && exists.item.name.toLowerCase() === args.name.trim().toLowerCase()) {
    return {
      tool: "create_lead",
      ok: false,
      clarification: true,
      line: `❓ ${leadLabel(exists.item)} já está no pipeline (${STAGE_LABEL[exists.item.stage]}). Quer atualizar?`,
    };
  }
  // Lead vivo precisa de próxima ação com data (constraint): sem dizer, vira follow-up no próximo dia útil.
  const nextAction = args.next_action?.trim() || "Fazer follow-up";
  const nextOn = args.next_action_on && args.next_action_on >= today ? args.next_action_on : nextBusinessDay(today);
  const { data, error } = await ctx.supabase
    .from("crm_leads")
    .insert({
      user_id: ctx.userId,
      name: args.name.trim(),
      business: args.business?.trim() || null,
      origin: args.origin ?? "abordagem_fria",
      stage: args.stage,
      next_action: nextAction,
      next_action_on: nextOn,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao criar lead: ${error.message}`);
  const lead: LeadLite = {
    id: data.id as string,
    name: args.name.trim(),
    business: args.business?.trim() || null,
    stage: args.stage,
    next_action: nextAction,
    next_action_on: nextOn,
  };
  ctx.routine.leads.push(lead);
  return {
    tool: "create_lead",
    ok: true,
    line: `✅ Lead: ${leadLabel(lead)} · ${STAGE_LABEL[lead.stage]} · próximo: ${nextAction.toLowerCase()} (${dayLabel(nextOn, today)})`,
    created: [{ table: "crm_leads", id: lead.id }],
    outreachAdded: args.stage === "abordado",
  };
}

export async function updateLead(args: Args<"update_lead">, ctx: ExecContext): Promise<ActionOutcome> {
  const today = todayISO(ctx.now);
  const m = matchByName(ctx.routine.leads, args.lead_ref, (l) => `${l.name} ${l.business ?? ""}`);
  if (!m) {
    // O modelo às vezes "atualiza" alguém que não está na lista: com etapa viva ou próximo passo, cadastra como novo.
    const live = args.stage !== "fechado" && args.stage !== "perdido";
    if (live && (args.stage || args.next_action || args.next_action_on)) {
      const created = await createLead(
        {
          name: args.lead_ref,
          business: null,
          origin: null,
          stage: (args.stage ?? "abordado") as "abordado" | "conversou" | "reuniao" | "proposta",
          next_action: args.next_action,
          next_action_on: args.next_action_on,
        },
        ctx,
      );
      return { ...created, tool: "update_lead" };
    }
    return { tool: "update_lead", ok: false, clarification: true, line: `❓ Não achei o lead "${args.lead_ref}" no pipeline. Cadastro como novo?` };
  }
  if ("ambiguous" in m) {
    return {
      tool: "update_lead",
      ok: false,
      clarification: true,
      line: `❓ Qual lead? ${m.ambiguous.slice(0, 4).map(leadLabel).join(", ")}`,
    };
  }
  const lead = m.item;
  const { data: before, error: readErr } = await ctx.supabase
    .from("crm_leads")
    .select("stage, next_action, next_action_on, lost_reason, monthly_value_cents, contract_status, closed_at, notes")
    .eq("id", lead.id)
    .eq("user_id", ctx.userId)
    .single();
  if (readErr) throw new Error(`Falha ao ler lead: ${readErr.message}`);

  const stage = (args.stage ?? before.stage) as LeadLite["stage"];
  if (stage === "perdido" && !args.lost_reason && before.stage !== "perdido") {
    return {
      tool: "update_lead",
      ok: false,
      clarification: true,
      line: `❓ Por que ${leadLabel(lead)} não fechou? Preço, timing, sem resposta, concorrente ou não viu valor?`,
    };
  }

  const patch: Record<string, unknown> = {};
  const parts: string[] = [];
  if (args.stage && args.stage !== before.stage) {
    patch.stage = args.stage;
    parts.push(`${STAGE_LABEL[before.stage as LeadLite["stage"]]} → ${STAGE_LABEL[args.stage]}`);
  }
  if (stage === "perdido") {
    patch.lost_reason = args.lost_reason ?? before.lost_reason;
    if (args.lost_reason) parts.push(`motivo: ${LOST_LABEL[args.lost_reason]}`);
  }
  if (args.monthly_value) {
    const cents = parseBRL(args.monthly_value);
    if (cents === null || cents <= 0) {
      return { tool: "update_lead", ok: false, clarification: true, line: `❓ Não entendi o valor "${args.monthly_value}". Quanto por mês?` };
    }
    patch.monthly_value_cents = cents;
    parts.push(`${formatBRL(cents, { cents: false })}/mês`);
  }
  if (LIVE(stage)) {
    const nextAction = args.next_action?.trim() || (before.next_action as string | null) || "Fazer follow-up";
    let nextOn = args.next_action_on ?? (before.next_action_on as string | null);
    if (!nextOn || nextOn < today) nextOn = nextBusinessDay(today);
    if (nextAction !== before.next_action) patch.next_action = nextAction;
    if (nextOn !== before.next_action_on) patch.next_action_on = nextOn;
    if (args.next_action || args.next_action_on) parts.push(`próximo: ${nextAction.toLowerCase()} (${dayLabel(nextOn, today)})`);
  } else if (args.stage) {
    // fechado/perdido não têm próximo passo
    patch.next_action = null;
    patch.next_action_on = null;
  }

  const outcome: ActionOutcome = { tool: "update_lead", ok: true, line: "" };
  const since = new Date(ctx.now.getTime() - 1000).toISOString();
  if (Object.keys(patch).length) {
    const { error } = await ctx.supabase.from("crm_leads").update(patch).eq("id", lead.id).eq("user_id", ctx.userId);
    if (error) throw new Error(`Falha ao atualizar lead: ${error.message}`);
    const restore: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) restore[k] = before[k as keyof typeof before];
    // ao voltar a etapa, o gatilho recalcula contrato/data; guardamos para restaurar exatamente
    if ("stage" in patch) {
      restore.contract_status = before.contract_status;
      restore.closed_at = before.closed_at;
      restore.lost_reason = before.lost_reason;
      restore.next_action = before.next_action;
      restore.next_action_on = before.next_action_on;
    }
    outcome.updated = [{ table: "crm_leads", id: lead.id, before: restore, since }];
    Object.assign(lead, { stage, ...(patch.next_action !== undefined ? { next_action: patch.next_action } : {}) });
  }
  if (args.note) {
    const { data, error } = await ctx.supabase
      .from("crm_lead_events")
      .insert({ user_id: ctx.userId, lead_id: lead.id, type: "note", payload: { text: args.note } })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao anotar: ${error.message}`);
    outcome.created = [{ table: "crm_lead_events", id: data.id as string }];
    parts.push("nota salva");
  }
  if (!parts.length) {
    return { tool: "update_lead", ok: true, line: `✅ ${leadLabel(lead)}: nada mudou.` };
  }
  outcome.line = `✅ ${leadLabel(lead)}: ${parts.join(" · ")}`;
  // fechou agora, saiu de fechado, ou mudou a mensalidade de um fechado → MRR mudou
  outcome.mrrChanged = Boolean(
    patch.stage === "fechado" || (patch.stage !== undefined && before.stage === "fechado") || (stage === "fechado" && "monthly_value_cents" in patch),
  );
  return outcome;
}

export async function logOutreach(args: Args<"log_outreach">, ctx: ExecContext): Promise<ActionOutcome> {
  const { data, error } = await ctx.supabase
    .from("outreach_logs")
    .insert({ user_id: ctx.userId, log_date: todayISO(ctx.now), count: args.count, channel: args.channel })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao registrar abordagens: ${error.message}`);
  return {
    tool: "log_outreach",
    ok: true,
    line: `✅ Abordagens: +${args.count}${args.channel ? ` (${args.channel === "ligacao" ? "ligação" : args.channel})` : ""}`,
    created: [{ table: "outreach_logs", id: data.id as string }],
    outreachAdded: true,
  };
}
