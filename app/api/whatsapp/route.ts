import { after, NextResponse, type NextRequest } from "next/server";
import { isValidApiToken } from "@/lib/api-auth";
import { whatsappEnv } from "@/lib/whatsapp/evolution";
import { firstTimeSeen, handleWhatsApp } from "@/lib/whatsapp/handle";
import { parseEvolutionWebhook } from "@/lib/whatsapp/webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webhook da Evolution API (WhatsApp). Responde 200 na hora (para a Evolution não reenviar)
 * e processa depois da resposta com `after()`: transcrição, ingest e resposta no WhatsApp.
 *
 * Token: header `x-nucleo-token` ou `?token=` na URL (a tela de webhook da Evolution nem
 * sempre deixa configurar header). Comparação em tempo constante nos dois casos.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-nucleo-token") ?? request.nextUrl.searchParams.get("token");
  if (!isValidApiToken(token)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const env = whatsappEnv();
  if (!env) {
    console.error("whatsapp: EVOLUTION_API_URL/KEY/INSTANCE ou PETER_WHATSAPP_NUMBER ausentes");
    return NextResponse.json({ error: "WhatsApp não configurado" }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const messages = parseEvolutionWebhook(body, { peterNumber: env.peterNumber, mode: env.mode }).filter((m) =>
    firstTimeSeen(m.messageId),
  );

  if (messages.length > 0) {
    after(async () => {
      for (const m of messages) await handleWhatsApp(m);
    });
  }
  return NextResponse.json({ ok: true, accepted: messages.length });
}
