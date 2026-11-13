import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBRL, parseBRL, toCents, type Cents } from "@/lib/money";
import { todayISO, type ISODate } from "@/lib/dates";
import { loadHighlightMilestone, syncAchievements } from "@/lib/data/milestone";
import type { ToolCall } from "./tools";

export interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
}

export interface ExecContext {
  supabase: SupabaseClient; // admin (service_role): SEMPRE filtrar/gravar com userId
  userId: string;
  inboxId: string;
  source: "whatsapp" | "siri" | "app";
  now: Date;
  categories: Category[];
}

export interface CreatedRef {
  table: "transactions";
  id: string;
}

export interface ActionOutcome {
  tool: ToolCall["name"];
  ok: boolean;
  /** Linha da resposta (WhatsApp). */
  line: string;
  created?: CreatedRef[];
  incomeAdded?: boolean;
  clarification?: boolean;
  undone?: boolean;
}

const brl = (c: Cents) => formatBRL(c, { cents: false });

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Acha a categoria pelo nome (sem acento/caixa). Sem encaixe: "Outras receitas" / "Outros". */
export function resolveCategory(categories: Category[], kind: Category["kind"], name: string | null): Category | null {
  const ofKind = categories.filter((c) => c.kind === kind);
  if (name) {
    const n = normalize(name);
    const exact = ofKind.find((c) => normalize(c.name) === n);
    if (exact) return exact;
    const partial = ofKind.find((c) => normalize(c.name).includes(n) || n.includes(normalize(c.name)));
    if (partial) return partial;
  }
  const fallbackName = kind === "income" ? "outras receitas" : "outros";
  return ofKind.find((c) => normalize(c.name) === fallbackName) ?? null;
}

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
function monthName(month: string): string {
  return monthFmt.format(new Date(`${month}-01T12:00:00Z`));
}

async function addTransaction(
  args: Extract<ToolCall, { name: "add_transaction" }>["args"],
  ctx: ExecContext,
): Promise<ActionOutcome> {
  const cents = parseBRL(args.amount);
  if (cents === null || cents <= 0) {
    return {
      tool: "add_transaction",
      ok: false,
      clarification: true,
      line: `❓ Não entendi o valor "${args.amount}". Quanto foi?`,
    };
  }
  const today = todayISO(ctx.now);
  const occurredOn: ISODate = args.occurred_on && args.occurred_on <= today ? args.occurred_on : today;
  const category = resolveCategory(ctx.categories, args.kind, args.category);

  const { data, error } = await ctx.supabase
    .from("transactions")
    .insert({
      user_id: ctx.userId,
      occurred_on: occurredOn,
      amount_cents: cents,
      kind: args.kind,
      category_id: category?.id ?? null,
      description: args.description,
      counterparty: args.counterparty,
      source: ctx.source,
      inbox_message_id: ctx.inboxId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao gravar lançamento: ${error.message}`);

  const label = args.kind === "income" ? "Receita" : "Despesa";
  const parts = [`${label} ${brl(cents)}`];
  if (category) parts.push(category.name);
  if (args.counterparty) parts.push(args.counterparty);
  else if (args.description) parts.push(args.description);
  if (occurredOn !== today) parts.push(`em ${occurredOn.slice(8, 10)}/${occurredOn.slice(5, 7)}`);

  return {
    tool: "add_transaction",
    ok: true,
    line: `✅ ${parts.join(" · ")}`,
    created: [{ table: "transactions", id: data.id as string }],
    incomeAdded: args.kind === "income",
  };
}

async function runQuery(args: Extract<ToolCall, { name: "query" }>["args"], ctx: ExecContext): Promise<ActionOutcome> {
  const month = args.month ?? todayISO(ctx.now).slice(0, 7);

  if (args.kind === "milestone_status") {
    const h = await loadHighlightMilestone(ctx.supabase, { userId: ctx.userId, now: ctx.now });
    if (!h) return { tool: "query", ok: true, line: "Nenhum marco ativo agora." };
    return { tool: "query", ok: true, line: milestoneLine(h.milestone.title, h.pace) + `\n${h.pace.summary}` };
  }

  if (args.kind === "month_summary") {
    const { data, error } = await ctx.supabase
      .from("v_month_totals")
      .select("income_cents, expense_cents, net_cents")
      .eq("user_id", ctx.userId)
      .eq("month", `${month}-01`)
      .maybeSingle();
    if (error) throw new Error(`Falha na consulta: ${error.message}`);
    const inc = toCents(data?.income_cents ?? 0);
    const exp = toCents(data?.expense_cents ?? 0);
    return {
      tool: "query",
      ok: true,
      line: `📊 ${monthName(month)}: receita ${brl(inc)} · despesa ${brl(exp)} · saldo ${brl(inc - exp)}`,
    };
  }

  // category_total
  const kindGuess = ctx.categories.find((c) => normalize(c.name) === normalize(args.category ?? ""))?.kind ?? "expense";
  const category = args.category ? resolveCategory(ctx.categories, kindGuess, args.category) : null;
  if (!category) return { tool: "query", ok: false, clarification: true, line: "❓ De qual categoria?" };
  const { data, error } = await ctx.supabase
    .from("v_category_breakdown")
    .select("total_cents, transaction_count")
    .eq("user_id", ctx.userId)
    .eq("month", `${month}-01`)
    .eq("category_id", category.id)
    .maybeSingle();
  if (error) throw new Error(`Falha na consulta: ${error.message}`);
  const total = toCents(data?.total_cents ?? 0);
  const n = data?.transaction_count ?? 0;
  return {
    tool: "query",
    ok: true,
    line: `🧾 ${category.name} em ${monthName(month)}: ${brl(total)} (${n} ${n === 1 ? "lançamento" : "lançamentos"})`,
  };
}

async function undoLast(ctx: ExecContext): Promise<ActionOutcome> {
  const { data: last, error } = await ctx.supabase
    .from("inbox_messages")
    .select("id, result")
    .eq("user_id", ctx.userId)
    .eq("status", "ok")
    .neq("id", ctx.inboxId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Falha ao buscar último lançamento: ${error.message}`);

  const target = (last ?? []).find((m) => Array.isArray(m.result?.created) && m.result.created.length > 0);
  if (!target) return { tool: "undo_last", ok: false, line: "Não tem nada pra desfazer." };

  const created = target.result.created as CreatedRef[];
  const ids = created.filter((c) => c.table === "transactions").map((c) => c.id);
  if (ids.length) {
    const { error: delError } = await ctx.supabase.from("transactions").delete().eq("user_id", ctx.userId).in("id", ids);
    if (delError) throw new Error(`Falha ao desfazer: ${delError.message}`);
  }
  const { error: upError } = await ctx.supabase
    .from("inbox_messages")
    .update({ status: "undone" })
    .eq("id", target.id)
    .eq("user_id", ctx.userId);
  if (upError) throw new Error(`Falha ao marcar como desfeito: ${upError.message}`);

  const lines: string[] = Array.isArray(target.result?.lines) ? target.result.lines : [];
  const what = lines.filter((l) => l.startsWith("✅")).map((l) => l.replace(/^✅\s*/, "")).join("; ");
  return { tool: "undo_last", ok: true, undone: true, line: `↩️ Desfeito${what ? `: ${what}` : "."}` };
}

export function milestoneLine(title: string, pace: { currentCents: Cents; remainingCents: Cents; pct: number; achieved: boolean }): string {
  if (pace.achieved) return `🏆 Marco "${title}" batido! ${brl(pace.currentCents)}`;
  return `📈 Marco "${title}": ${brl(pace.currentCents)} → faltam ${brl(pace.remainingCents)} (${Math.floor(pace.pct * 100)}%)`;
}

export function achievementLine(title: string, currentCents: Cents, days: number): string {
  return `🏆 Marco "${title}" batido! ${brl(currentCents)} em ${days} ${days === 1 ? "dia" : "dias"}`;
}

export async function executeCalls(calls: ToolCall[], ctx: ExecContext): Promise<ActionOutcome[]> {
  const out: ActionOutcome[] = [];
  for (const call of calls) {
    switch (call.name) {
      case "add_transaction":
        out.push(await addTransaction(call.args, ctx));
        break;
      case "query":
        out.push(await runQuery(call.args, ctx));
        break;
      case "undo_last":
        out.push(await undoLast(ctx));
        break;
      case "ask_clarification":
        out.push({ tool: "ask_clarification", ok: false, clarification: true, line: `❓ ${call.args.question}` });
        break;
    }
  }
  return out;
}

/** Monta a resposta: linhas das ações + estado do marco se entrou receita + dica do "desfaz". */
export async function composeReply(outcomes: ActionOutcome[], ctx: ExecContext): Promise<string> {
  const lines = outcomes.map((o) => o.line);
  // Qualquer lançamento pode bater um marco (receita ou saldo do mês).
  if (outcomes.some((o) => o.created?.length)) {
    const batidos = await syncAchievements(ctx.supabase, { userId: ctx.userId, now: ctx.now });
    for (const b of batidos) lines.push(achievementLine(b.title, b.currentCents, b.days));
  }
  if (outcomes.some((o) => o.incomeAdded)) {
    const h = await loadHighlightMilestone(ctx.supabase, { userId: ctx.userId, now: ctx.now });
    if (h) lines.push(milestoneLine(h.milestone.title, h.pace));
  }
  if (outcomes.some((o) => o.created?.length)) lines.push('↩️ "desfaz" pra reverter');
  return lines.join("\n");
}
