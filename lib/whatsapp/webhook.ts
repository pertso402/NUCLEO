/**
 * Leitura do webhook da Evolution API (evento `messages.upsert`). Puro, sem I/O: decide se a
 * mensagem é do Peter e extrai texto ou áudio. O resto (grupos, status, outros números,
 * reenvios antigos, as próprias respostas do NÚCLEO) vira lista vazia.
 */

/**
 * - `numero_separado`: a instância é um número só do NÚCLEO e o Peter manda mensagem pra ele.
 * - `meu_numero`: a instância é o WhatsApp do próprio Peter; vale o chat "Mensagem para mim".
 */
export type WhatsAppMode = "numero_separado" | "meu_numero";

export interface IncomingWhatsApp {
  /** Só dígitos, para responder (`55DDDNUMERO`). */
  number: string;
  messageId: string;
  /** ISO do envio. */
  ts: string;
  kind: "text" | "audio";
  text: string | null;
  /** Áudio em base64 quando a Evolution está com "Webhook Base64" ligado. */
  base64: string | null;
  mimetype: string | null;
}

/** Abre toda resposta do NÚCLEO (invisível). O filtro ignora o que começa com ela → sem loop. */
export const REPLY_MARK = "⁣";
/** A Evolution reenvia mensagens antigas ao reconectar: não relançar. */
export const MAX_AGE_SECONDS = 300;

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Celular BR: o WhatsApp às vezes guarda o número sem o 9 depois do DDD. Compara sem ele. */
export function canonicalNumber(n: unknown): string {
  const d = digits(n);
  return /^55\d{2}9\d{8}$/.test(d) ? d.slice(0, 4) + d.slice(5) : d;
}

const isPhoneJid = (j: unknown): j is string => typeof j === "string" && j.endsWith("@s.whatsapp.net");

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

export function parseEvolutionWebhook(
  body: unknown,
  opts: { peterNumber: string; mode: WhatsAppMode; now?: Date },
): IncomingWhatsApp[] {
  const peter = canonicalNumber(opts.peterNumber);
  const root = obj(body);
  if (!peter || !root) return [];

  const event = String(root.event ?? "messages.upsert").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return [];

  const nowS = (opts.now ?? new Date()).getTime() / 1000;
  const list = Array.isArray(root.data) ? root.data : [root.data];
  const out: IncomingWhatsApp[] = [];

  for (const raw of list) {
    const data = obj(raw);
    const key = obj(data?.key);
    const m = obj(data?.message);
    if (!data || !key || !m) continue;

    const jid = String(key.remoteJid ?? "");
    if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) continue;

    // Conversas novas podem vir com @lid; o número de verdade fica em remoteJidAlt/senderPn.
    const phoneJid = [key.remoteJidAlt, key.senderPn, jid].find(isPhoneJid);
    if (!phoneJid || canonicalNumber(phoneJid) !== peter) continue;

    const fromMe = key.fromMe === true;
    if (opts.mode === "meu_numero" ? !fromMe : fromMe) continue;

    const ts = Number(data.messageTimestamp ?? 0);
    if (ts > 0 && nowS - ts > MAX_AGE_SECONDS) continue;

    const inner = obj(obj(m.ephemeralMessage)?.message) ?? m;
    const audio = obj(inner.audioMessage);
    const text = inner.conversation ?? obj(inner.extendedTextMessage)?.text ?? null;

    const base = {
      number: digits(phoneJid),
      messageId: String(key.id ?? ""),
      ts: new Date(ts > 0 ? ts * 1000 : (opts.now ?? new Date()).getTime()).toISOString(),
    };

    if (audio || data.messageType === "audioMessage") {
      const b64 = m.base64 ?? data.base64;
      out.push({
        ...base,
        kind: "audio",
        text: null,
        base64: typeof b64 === "string" && b64 ? b64 : null,
        mimetype: String(audio?.mimetype ?? "audio/ogg").split(";")[0]!.trim(),
      });
      continue;
    }

    if (typeof text === "string" && text.trim() && !text.startsWith(REPLY_MARK)) {
      out.push({ ...base, kind: "text", text: text.trim(), base64: null, mimetype: null });
    }
  }
  return out;
}

/** Texto que volta no WhatsApp. No áudio, ecoa o que foi entendido para o Peter conferir. */
export function composeWhatsAppReply(input: {
  kind: "text" | "audio";
  heard?: string | null;
  replyText?: string | null;
}): string {
  let reply = input.replyText?.trim() || "Não consegui processar agora. Tenta de novo em texto.";
  if (input.kind === "audio") {
    const heard = input.heard?.trim() ?? "";
    reply = heard ? `🎙️ "${heard}"\n${reply}` : "Não entendi o áudio. Pode mandar de novo ou escrever?";
  }
  return REPLY_MARK + reply;
}
