import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/api-auth";
import { resolveOwnerId } from "@/lib/ingest/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText, whatsappEnv } from "@/lib/whatsapp/evolution";
import { REPLY_MARK } from "@/lib/whatsapp/webhook";
import { todayISO, weekday } from "@/lib/dates";
import type { MessageFacts } from "./compose";
import { loadBriefingFacts, loadClosingFacts, loadWeeklyFacts } from "./facts";
import { writeMessage } from "./writer";

/**
 * Executa uma rotina agendada (Vercel Cron → GET; chamada manual → GET/POST com x-nucleo-token).
 * `?dry=1`: só monta e devolve o texto (não envia nem grava). `?force=1`: ignora "não é dia útil".
 */
export async function runScheduled(kind: "briefing" | "closing" | "weekly", request: NextRequest) {
  if (!isAuthorizedCron(request.headers)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const url = request.nextUrl;
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";
  const now = new Date();
  const today = todayISO(now);

  try {
    const supabase = createAdminClient();
    const userId = await resolveOwnerId(supabase);
    const ctx = { supabase, userId, now };

    if (kind === "briefing" && !force) {
      const { data } = await supabase.from("settings").select("workdays").eq("user_id", userId).maybeSingle();
      const workdays = (data?.workdays as number[] | undefined) ?? [1, 2, 3, 4, 5];
      if (!workdays.includes(weekday(today))) {
        return NextResponse.json({ ok: true, kind, skipped: "não é dia útil" });
      }
    }

    if (kind === "weekly" && !force && weekday(today) !== 0) {
      return NextResponse.json({ ok: true, kind, skipped: "a revisão semanal é no domingo" });
    }

    let facts: MessageFacts;
    if (kind === "briefing") facts = await loadBriefingFacts(ctx);
    else if (kind === "closing") facts = await loadClosingFacts(ctx, `${url.origin}/revisao`);
    else {
      const w = await loadWeeklyFacts(ctx, `${url.origin}/revisao?aba=semana`);
      facts = w.facts;
      // Foto dos números da semana (o texto da revisão o Peter completa na tela; não sobrescreve).
      if (!dry) {
        const { error } = await supabase
          .from("weekly_reviews")
          .upsert({ user_id: userId, week_start: w.weekStart, numbers: w.numbers }, { onConflict: "user_id,week_start" });
        if (error) console.error("cron: falha ao gravar números da semana", error.message);
      }
    }

    // O fechamento grava o score do dia (a Revisão completa o resto — 2.7).
    if (kind === "closing" && !dry) {
      const { error } = await supabase
        .from("daily_reviews")
        .upsert({ user_id: userId, review_date: today, score: facts.kind === "closing" ? facts.score : null }, { onConflict: "user_id,review_date" });
      if (error) console.error("cron: falha ao gravar score", error.message);
    }

    const message = await writeMessage(facts);
    if (message.error) console.warn(`cron ${kind}: texto de reserva (${message.error})`);

    let sent = false;
    let sendError: string | undefined;
    const wa = whatsappEnv();
    if (dry) {
      sendError = "simulação (dry=1)";
    } else if (!wa) {
      sendError = "WhatsApp não configurado";
    } else {
      try {
        await sendText(wa, wa.peterNumber.replace(/\D/g, ""), REPLY_MARK + message.text);
        sent = true;
      } catch (err) {
        sendError = err instanceof Error ? err.message : String(err);
        console.error(`cron ${kind}: falha ao enviar`, sendError);
      }
    }

    return NextResponse.json({
      ok: true,
      kind,
      date: today,
      source: message.source,
      sent,
      ...(sendError ? { not_sent: sendError } : {}),
      ...(dry ? { text: message.text } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`cron ${kind} falhou`, msg);
    return NextResponse.json({ ok: false, kind, error: msg }, { status: 500 });
  }
}
