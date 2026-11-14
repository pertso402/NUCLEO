import { describe, expect, it } from "vitest";
import {
  canonicalNumber,
  composeWhatsAppReply,
  parseEvolutionWebhook,
  type WhatsAppMode,
} from "@/lib/whatsapp/webhook";

type Json = Record<string, unknown>;
const NOW = new Date("2026-11-13T15:00:00Z");
const NOW_S = NOW.getTime() / 1000;
const PETER = "5511987654321";

const parse = (body: unknown, opts: { peterNumber?: string; mode?: WhatsAppMode } = {}) =>
  parseEvolutionWebhook(body, { peterNumber: PETER, mode: "numero_separado", now: NOW, ...opts });

function upsert(key: Json, message: Json, extra: Json = {}): Json {
  return {
    event: "messages.upsert",
    instance: "nucleo",
    data: { key: { id: "MSG1", fromMe: false, ...key }, message, messageTimestamp: NOW_S - 2, ...extra },
  };
}
const fromPeter = (message: Json, extra?: Json) => upsert({ remoteJid: `${PETER}@s.whatsapp.net` }, message, extra);

describe("webhook da Evolution", () => {
  it("deixa passar texto do Peter com número, id e horário", () => {
    expect(parse(fromPeter({ conversation: "  gastei 38 no almoço " }))).toEqual([
      {
        number: PETER,
        messageId: "MSG1",
        ts: new Date((NOW_S - 2) * 1000).toISOString(),
        kind: "text",
        text: "gastei 38 no almoço",
        base64: null,
        mimetype: null,
      },
    ]);
  });

  it("aceita texto com link/citação (extendedTextMessage) e mensagem temporária", () => {
    expect(parse(fromPeter({ extendedTextMessage: { text: "recebi 1500" } }))[0]?.text).toBe("recebi 1500");
    expect(parse(fromPeter({ ephemeralMessage: { message: { conversation: "desfaz" } } }))[0]?.text).toBe("desfaz");
  });

  it("casa o número com ou sem o 9 depois do DDD", () => {
    expect(canonicalNumber("5511987654321")).toBe("551187654321");
    expect(parse(upsert({ remoteJid: "551187654321@s.whatsapp.net" }, { conversation: "oi" }))).toHaveLength(1);
    expect(parse(fromPeter({ conversation: "oi" }), { peterNumber: "+55 (11) 8765-4321" })).toHaveLength(1);
  });

  it("descarta outros números, grupos, status, eventos que não são mensagem e lixo", () => {
    const bodies: unknown[] = [
      upsert({ remoteJid: "5511911112222@s.whatsapp.net" }, { conversation: "oi" }),
      upsert({ remoteJid: "120363000000@g.us", participant: `${PETER}@s.whatsapp.net` }, { conversation: "oi" }),
      upsert({ remoteJid: "status@broadcast" }, { conversation: "oi" }),
      { event: "connection.update", data: { state: "open" } },
      { event: "MESSAGES_UPDATE", data: { key: { remoteJid: `${PETER}@s.whatsapp.net` }, message: { conversation: "x" } } },
      null,
      "texto",
      { event: "messages.upsert" },
    ];
    for (const b of bodies) expect(parse(b)).toEqual([]);
  });

  it("aceita o evento no formato MESSAGES_UPSERT", () => {
    expect(parse({ ...fromPeter({ conversation: "oi" }), event: "MESSAGES_UPSERT" })).toHaveLength(1);
  });

  it("usa o número real quando a conversa vem com @lid", () => {
    expect(parse(upsert({ remoteJid: "123@lid", senderPn: `${PETER}@s.whatsapp.net` }, { conversation: "oi" }))[0]?.number).toBe(PETER);
    expect(parse(upsert({ remoteJid: "123@lid", remoteJidAlt: `${PETER}@s.whatsapp.net` }, { conversation: "oi" }))).toHaveLength(1);
    expect(parse(upsert({ remoteJid: "123@lid" }, { conversation: "oi" }))).toEqual([]);
  });

  it("modo numero_separado ignora o que a própria instância envia", () => {
    expect(parse(upsert({ remoteJid: `${PETER}@s.whatsapp.net`, fromMe: true }, { conversation: "✅ Receita" }))).toEqual([]);
  });

  it("modo meu_numero aceita o chat 'Mensagem para mim' e ignora as respostas do NÚCLEO", () => {
    const minha = upsert({ remoteJid: `${PETER}@s.whatsapp.net`, fromMe: true }, { conversation: "gastei 20" });
    const resposta = upsert({ remoteJid: `${PETER}@s.whatsapp.net`, fromMe: true }, { conversation: "⁣✅ Despesa" });
    const deFora = fromPeter({ conversation: "recebida de fora" });
    expect(parse(minha, { mode: "meu_numero" })).toHaveLength(1);
    expect(parse(resposta, { mode: "meu_numero" })).toEqual([]);
    expect(parse(deFora, { mode: "meu_numero" })).toEqual([]);
  });

  it("descarta mensagem com mais de 5 minutos (reenvio ao reconectar)", () => {
    expect(parse(fromPeter({ conversation: "velha" }, { messageTimestamp: NOW_S - 301 }))).toEqual([]);
    expect(parse(fromPeter({ conversation: "nova" }, { messageTimestamp: NOW_S - 299 }))).toHaveLength(1);
  });

  it("áudio: kind=audio, base64 do webhook quando vier e mimetype limpo", () => {
    const [a] = parse(fromPeter({ audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true }, base64: "T2dnUw==" }));
    const [b] = parse(fromPeter({ audioMessage: { mimetype: "audio/mp4" } }));
    expect(a).toMatchObject({ kind: "audio", text: null, base64: "T2dnUw==", mimetype: "audio/ogg" });
    expect(b).toMatchObject({ kind: "audio", base64: null, mimetype: "audio/mp4" });
  });

  it("sem número configurado não deixa nada passar", () => {
    expect(parse(fromPeter({ conversation: "oi" }), { peterNumber: "" })).toEqual([]);
  });
});

describe("resposta no WhatsApp", () => {
  it("texto: devolve o reply_text com a marca invisível na frente", () => {
    expect(composeWhatsAppReply({ kind: "text", replyText: "✅ Despesa R$ 38" })).toBe("⁣✅ Despesa R$ 38");
  });

  it("áudio: ecoa o que foi entendido antes da confirmação", () => {
    expect(composeWhatsAppReply({ kind: "audio", heard: " recebi 1500 ", replyText: "✅ Receita R$ 1.500" })).toBe(
      '⁣🎙️ "recebi 1500"\n✅ Receita R$ 1.500',
    );
  });

  it("áudio sem fala e falha do pipeline viram mensagens amigáveis", () => {
    expect(composeWhatsAppReply({ kind: "audio", heard: "" })).toBe("⁣Não entendi o áudio. Pode mandar de novo ou escrever?");
    expect(composeWhatsAppReply({ kind: "text", replyText: null })).toBe(
      "⁣Não consegui processar agora. Tenta de novo em texto.",
    );
  });
});
