import "server-only";
import { runIngest } from "@/lib/ingest/run";
import { rateLimit } from "@/lib/rate-limit";
import { fetchMediaBase64, sendText, whatsappEnv } from "./evolution";
import { transcribeAudio } from "./stt";
import { composeWhatsAppReply, type IncomingWhatsApp } from "./webhook";

/** A Evolution às vezes entrega o mesmo evento duas vezes. Memória curta por instância. */
const seen = new Map<string, number>();
export function firstTimeSeen(messageId: string, now = Date.now()): boolean {
  if (!messageId) return true;
  for (const [id, t] of seen) if (now - t > 10 * 60_000) seen.delete(id);
  if (seen.has(messageId)) return false;
  seen.set(messageId, now);
  return true;
}

/**
 * Uma mensagem do Peter: (áudio → transcrição) → mesmo pipeline do /api/ingest → resposta no WhatsApp.
 * Nunca lança: qualquer falha vira uma resposta amigável e um log.
 */
export async function handleWhatsApp(msg: IncomingWhatsApp): Promise<void> {
  const env = whatsappEnv();
  if (!env) return;
  let heard: string | null = null;
  let replyText: string | null = null;

  try {
    if (!rateLimit("ingest:whatsapp").ok) {
      replyText = "Muitas mensagens seguidas. Espera um minuto.";
    } else {
      let text = msg.text;
      if (msg.kind === "audio") {
        const media = msg.base64 ? { base64: msg.base64, mimetype: msg.mimetype } : await fetchMediaBase64(env, msg.messageId);
        heard = (await transcribeAudio(Buffer.from(media.base64, "base64"), media.mimetype ?? msg.mimetype)).text;
        text = heard;
      }
      if (text) replyText = (await runIngest({ channel: "whatsapp", text })).reply_text;
    }
  } catch (err) {
    console.error("whatsapp: falha ao processar", msg.messageId, err instanceof Error ? err.message : err);
  }

  try {
    await sendText(env, msg.number, composeWhatsAppReply({ kind: msg.kind, heard, replyText }));
  } catch (err) {
    console.error("whatsapp: falha ao responder", msg.messageId, err instanceof Error ? err.message : err);
  }
}
