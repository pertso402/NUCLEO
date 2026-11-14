import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Os nós Code do workflow n8n rodam aqui do jeito que estão no JSON exportado,
 * com `$`, `$input` e `$json` simulados.
 */
const dir = path.resolve(__dirname, "../../integrations/n8n");
const read = (f: string) => readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n");
const filterSrc = read("src/filtro-whatsapp.js");
const replySrc = read("src/montar-resposta.js");

type Json = Record<string, unknown>;
const NOW = new Date("2026-11-13T15:00:00Z");
const NOW_S = NOW.getTime() / 1000;
const PETER = "5511987654321";

function runFilter(bodies: Json[], config: Json = {}): Json[] {
  const cfg = { numero_peter: PETER, modo: "numero_separado", ...config };
  const $ = () => ({ first: () => ({ json: cfg }) });
  const $input = { all: () => bodies.map((b) => ({ json: { body: b, ...cfg } })) };
  const out = new Function("$", "$input", filterSrc)($, $input) as { json: Json }[];
  return out.map((o) => o.json);
}

function upsert(key: Json, message: Json, extra: Json = {}): Json {
  return {
    event: "messages.upsert",
    instance: "nucleo",
    data: { key: { id: "MSG1", fromMe: false, ...key }, message, messageTimestamp: NOW_S - 2, ...extra },
  };
}
const fromPeter = (message: Json, extra?: Json) => upsert({ remoteJid: `${PETER}@s.whatsapp.net` }, message, extra);

describe("filtro do webhook da Evolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("deixa passar texto do Peter com número, id e horário", () => {
    expect(runFilter([fromPeter({ conversation: "  gastei 38 no almoço " })])).toEqual([
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
    const out = runFilter([
      fromPeter({ extendedTextMessage: { text: "recebi 1500" } }),
      fromPeter({ ephemeralMessage: { message: { conversation: "desfaz" } } }),
    ]);
    expect(out.map((o) => o.text)).toEqual(["recebi 1500", "desfaz"]);
  });

  it("casa o número com ou sem o 9 depois do DDD", () => {
    const semNove = upsert({ remoteJid: "551187654321@s.whatsapp.net" }, { conversation: "oi" });
    expect(runFilter([semNove])).toHaveLength(1);
    expect(runFilter([fromPeter({ conversation: "oi" })], { numero_peter: "+55 (11) 8765-4321" })).toHaveLength(1);
  });

  it("descarta outros números, grupos, status e eventos que não são mensagem", () => {
    const out = runFilter([
      upsert({ remoteJid: "5511911112222@s.whatsapp.net" }, { conversation: "oi" }),
      upsert({ remoteJid: "120363000000@g.us", participant: `${PETER}@s.whatsapp.net` }, { conversation: "oi" }),
      upsert({ remoteJid: "status@broadcast" }, { conversation: "oi" }),
      { event: "connection.update", data: { state: "open" } },
      { event: "MESSAGES_UPDATE", data: { key: { remoteJid: `${PETER}@s.whatsapp.net` }, message: { conversation: "x" } } },
    ]);
    expect(out).toEqual([]);
  });

  it("usa o número real quando a conversa vem com @lid", () => {
    const lid = upsert({ remoteJid: "123456789@lid", senderPn: `${PETER}@s.whatsapp.net` }, { conversation: "oi" });
    const semNumero = upsert({ remoteJid: "123456789@lid" }, { conversation: "oi" });
    expect(runFilter([lid, semNumero]).map((o) => o.number)).toEqual([PETER]);
  });

  it("modo numero_separado ignora o que a própria instância envia", () => {
    const enviada = upsert({ remoteJid: `${PETER}@s.whatsapp.net`, fromMe: true }, { conversation: "✅ Receita" });
    expect(runFilter([enviada])).toEqual([]);
  });

  it("modo meu_numero aceita o chat 'Mensagem para mim' e ignora as respostas do NÚCLEO", () => {
    const minha = upsert({ remoteJid: `${PETER}@s.whatsapp.net`, fromMe: true }, { conversation: "gastei 20" });
    const resposta = upsert({ remoteJid: `${PETER}@s.whatsapp.net`, fromMe: true }, { conversation: "⁣✅ Despesa" });
    const deOutro = fromPeter({ conversation: "recebida de fora" });
    expect(runFilter([minha, resposta, deOutro], { modo: "meu_numero" }).map((o) => o.text)).toEqual(["gastei 20"]);
  });

  it("descarta mensagem com mais de 5 minutos (reenvio ao reconectar)", () => {
    expect(runFilter([fromPeter({ conversation: "velha" }, { messageTimestamp: NOW_S - 301 })])).toEqual([]);
    expect(runFilter([fromPeter({ conversation: "nova" }, { messageTimestamp: NOW_S - 299 })])).toHaveLength(1);
  });

  it("áudio: marca kind=audio, repassa o base64 quando vem no webhook e limpa o mimetype", () => {
    const comBase64 = fromPeter({ audioMessage: { mimetype: "audio/ogg; codecs=opus", ptt: true }, base64: "T2dnUw==" });
    const semBase64 = fromPeter({ audioMessage: { mimetype: "audio/mp4" } });
    const [a, b] = runFilter([comBase64, semBase64]);
    expect(a).toMatchObject({ kind: "audio", text: null, base64: "T2dnUw==", mimetype: "audio/ogg" });
    expect(b).toMatchObject({ kind: "audio", base64: null, mimetype: "audio/mp4" });
  });

  it("sem número configurado, avisa em vez de deixar tudo passar", () => {
    expect(() => runFilter([fromPeter({ conversation: "oi" })], { numero_peter: "" })).toThrow(/numero_peter/);
  });
});

describe("montar resposta", () => {
  function runReply(ingest: Json, msg: Json, transcript?: string): Json {
    const nodes: Record<string, unknown> = {
      "Filtrar mensagem do Peter": { item: { json: msg } },
      "Transcrever (ElevenLabs)": {
        isExecuted: transcript !== undefined,
        item: { json: { text: transcript } },
      },
    };
    const $ = (name: string) => nodes[name];
    return (new Function("$", "$json", replySrc)($, ingest) as { json: Json }).json;
  }

  it("texto: devolve o reply_text com a marca invisível na frente", () => {
    expect(runReply({ reply_text: "✅ Despesa R$ 38" }, { kind: "text", number: PETER })).toEqual({
      number: PETER,
      text: "⁣✅ Despesa R$ 38",
    });
  });

  it("áudio: ecoa o que foi entendido antes da confirmação", () => {
    const r = runReply({ reply_text: "✅ Receita R$ 1.500" }, { kind: "audio", number: PETER }, " recebi 1500 ");
    expect(r.text).toBe('⁣🎙️ "recebi 1500"\n✅ Receita R$ 1.500');
  });

  it("áudio sem fala e falha do NÚCLEO viram mensagens amigáveis", () => {
    expect(runReply({}, { kind: "audio", number: PETER }, "").text).toBe(
      "⁣Não entendi o áudio. Pode mandar de novo ou escrever?",
    );
    expect(runReply({ error: "não autorizado" }, { kind: "text", number: PETER }).text).toBe(
      "⁣Não consegui processar agora. Tenta de novo em texto.",
    );
  });
});

describe("workflow exportado", () => {
  const wf = JSON.parse(readFileSync(path.join(dir, "nucleo-whatsapp.json"), "utf8")) as {
    nodes: { name: string; parameters: { jsCode?: string; url?: string } }[];
    connections: Record<string, unknown>;
  };
  const node = (name: string) => wf.nodes.find((n) => n.name === name)!;

  it("está em dia com src/ (rode `node integrations/n8n/build.mjs` depois de editar)", () => {
    expect(node("Filtrar mensagem do Peter").parameters.jsCode).toBe(filterSrc);
    expect(node("Montar resposta").parameters.jsCode).toBe(replySrc);
  });

  it("não carrega segredo nenhum: chaves ficam nas credenciais do n8n", () => {
    const raw = JSON.stringify(wf);
    expect(raw).not.toMatch(/sk-|xi-api-key|apikey"|x-nucleo-token/i);
    expect(node("Lançar no NÚCLEO").parameters.url).toContain("/api/ingest");
  });

  it("toda conexão aponta para um nó que existe", () => {
    const names = new Set(wf.nodes.map((n) => n.name));
    const targets = JSON.stringify(wf.connections).match(/"node":"[^"]+"/g) ?? [];
    for (const t of targets) expect(names.has(t.slice(8, -1))).toBe(true);
    for (const src of Object.keys(wf.connections)) expect(names.has(src)).toBe(true);
  });
});
