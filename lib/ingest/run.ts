import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { composeReply, executeCalls, type ActionOutcome, type Category } from "./executor";
import { parseMessage, ParserError } from "./parser";

export type Channel = "whatsapp" | "siri" | "app" | "palette";

export interface IngestResponse {
  status: "ok" | "needs_clarification" | "error";
  reply_text: string;
  actions: { tool: string; ok: boolean; line: string }[];
  inbox_id: string | null;
}

const CLARIFICATION_WINDOW_MS = 10 * 60_000;

let ownerIdCache: string | null = null;

/**
 * Usuário dono do NÚCLEO. O projeto Supabase é compartilhado com outros sistemas, então
 * não dá pra pegar "o primeiro usuário": é quem tem a linha em `settings` (só o Peter).
 */
export async function resolveOwnerId(supabase: SupabaseClient): Promise<string> {
  if (ownerIdCache) return ownerIdCache;
  const { data, error } = await supabase.from("settings").select("user_id").limit(2);
  if (error) throw new Error(`Falha ao achar o dono: ${error.message}`);
  if (!data || data.length !== 1) throw new Error(`Esperava 1 linha em settings, achei ${data?.length ?? 0}`);
  ownerIdCache = data[0]!.user_id as string;
  return ownerIdCache;
}

function sourceOf(channel: Channel): "whatsapp" | "siri" | "app" {
  return channel === "whatsapp" || channel === "siri" ? channel : "app";
}

/** Pipeline completo do /api/ingest: registra no inbox, entende, executa e responde. */
export async function runIngest(input: { channel: Channel; text: string; now?: Date }): Promise<IngestResponse> {
  const now = input.now ?? new Date();
  const supabase = createAdminClient();
  const userId = await resolveOwnerId(supabase);

  // 1. Registra a captura antes de tudo (é o que permite depurar e desfazer).
  const { data: inbox, error: inboxError } = await supabase
    .from("inbox_messages")
    .insert({ user_id: userId, channel: input.channel, raw_text: input.text, status: "error", error: "processando" })
    .select("id")
    .single();
  if (inboxError) throw new Error(`Falha ao registrar mensagem: ${inboxError.message}`);
  const inboxId = inbox.id as string;

  const finish = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("inbox_messages").update(patch).eq("id", inboxId);
    if (error) console.error("inbox update falhou", error.message);
  };

  try {
    // 2. Contexto: categorias e uma possível pergunta pendente no mesmo canal.
    const [{ data: cats, error: catError }, { data: prev }] = await Promise.all([
      supabase.from("categories").select("id, name, kind").eq("user_id", userId).eq("archived", false).order("name"),
      supabase
        .from("inbox_messages")
        .select("raw_text, reply_text, created_at")
        .eq("user_id", userId)
        .eq("channel", input.channel)
        .eq("status", "needs_clarification")
        .neq("id", inboxId)
        .gte("created_at", new Date(now.getTime() - CLARIFICATION_WINDOW_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (catError) throw new Error(`Falha ao ler categorias: ${catError.message}`);
    const categories = (cats ?? []) as Category[];

    // 3. Entende a mensagem.
    const parsed = await parseMessage(input.text, {
      now,
      incomeCategories: categories.filter((c) => c.kind === "income").map((c) => c.name),
      expenseCategories: categories.filter((c) => c.kind === "expense").map((c) => c.name),
      pendingClarification:
        prev?.raw_text && prev.reply_text ? { originalText: prev.raw_text, question: prev.reply_text } : null,
    });

    // 4. Executa e responde.
    const ctx = { supabase, userId, inboxId, source: sourceOf(input.channel), now, categories };
    const outcomes: ActionOutcome[] = await executeCalls(parsed.calls, ctx);
    const reply = await composeReply(outcomes, ctx);
    const created = outcomes.flatMap((o) => o.created ?? []);
    const onlyClarification = created.length === 0 && outcomes.some((o) => o.clarification) && !outcomes.some((o) => o.ok);
    const status = onlyClarification ? "needs_clarification" : "ok";

    await finish({
      parsed: { model: parsed.model, calls: parsed.calls },
      result: { created, lines: outcomes.map((o) => o.line) },
      status,
      reply_text: reply,
      error: null,
    });
    return {
      status,
      reply_text: reply,
      actions: outcomes.map((o) => ({ tool: o.tool, ok: o.ok, line: o.line })),
      inbox_id: inboxId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reply = "⚠️ Não consegui processar agora. Tenta de novo em instantes?";
    await finish({
      status: "error",
      error: message,
      reply_text: reply,
      parsed: err instanceof ParserError ? { raw: err.raw } : null,
    });
    console.error("ingest falhou", message);
    return { status: "error", reply_text: reply, actions: [], inbox_id: inboxId };
  }
}
