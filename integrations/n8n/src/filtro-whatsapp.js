/* global $, $input */
// NÚCLEO · nó "Filtrar mensagem do Peter" (Code, rodar uma vez para todos os itens).
// Deixa passar só texto ou áudio do Peter. O resto (grupos, status, outros números,
// mensagens antigas reenviadas, as próprias respostas do NÚCLEO) é descartado em silêncio.
// Fonte: integrations/n8n/src/filtro-whatsapp.js (o JSON é gerado por build.mjs).
const config = $('Config').first().json;
const MARK = '⁣'; // marca invisível que abre toda resposta do NÚCLEO (evita loop)
const MAX_AGE_S = 300; // a Evolution reenvia mensagens antigas ao reconectar; não relançar

const digits = (s) => String(s ?? '').replace(/\D/g, '');
// Celular BR: o WhatsApp às vezes guarda o número sem o 9 depois do DDD. Compara sem ele.
const canon = (n) => {
  const d = digits(n);
  return /^55\d{2}9\d{8}$/.test(d) ? d.slice(0, 4) + d.slice(5) : d;
};
const isPhoneJid = (j) => typeof j === 'string' && j.endsWith('@s.whatsapp.net');

const peter = canon(config.numero_peter);
if (!peter) throw new Error('Config: preencha numero_peter (55DDDNUMERO).');
const ownNumberMode = config.modo === 'meu_numero';

const out = [];
for (const item of $input.all()) {
  const body = item.json.body ?? item.json;
  const event = String(body.event ?? 'messages.upsert').toLowerCase().replace(/_/g, '.');
  if (event !== 'messages.upsert') continue;

  const data = Array.isArray(body.data) ? body.data[0] : body.data;
  const key = data?.key;
  const m = data?.message;
  if (!key || !m) continue;

  const jid = String(key.remoteJid ?? '');
  if (jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) continue;

  // Conversas novas podem vir com @lid; o número de verdade fica em remoteJidAlt/senderPn.
  const phoneJid = [key.remoteJidAlt, key.senderPn, jid].find(isPhoneJid);
  if (!phoneJid || canon(phoneJid) !== peter) continue;

  // numero_separado: o Peter escreve para o número do NÚCLEO (só mensagens recebidas).
  // meu_numero: a instância é o próprio WhatsApp do Peter; vale o chat "Mensagem para mim".
  if (ownNumberMode ? key.fromMe !== true : key.fromMe === true) continue;

  const ts = Number(data.messageTimestamp ?? 0);
  if (ts > 0 && Date.now() / 1000 - ts > MAX_AGE_S) continue;

  const inner = m.ephemeralMessage?.message ?? m;
  const audio = inner.audioMessage;
  const text = inner.conversation ?? inner.extendedTextMessage?.text ?? null;

  const base = {
    number: digits(phoneJid),
    messageId: key.id,
    ts: ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
  };

  if (audio || data.messageType === 'audioMessage') {
    out.push({
      json: {
        ...base,
        kind: 'audio',
        text: null,
        // Com "Webhook Base64" ligado na Evolution o áudio já vem aqui (recomendado: o
        // download separado falha com áudio do iPhone em algumas versões da Evolution).
        base64: m.base64 ?? data.base64 ?? null,
        mimetype: (audio?.mimetype ?? 'audio/ogg').split(';')[0],
      },
    });
    continue;
  }

  if (typeof text === 'string' && text.trim() && !text.startsWith(MARK)) {
    out.push({ json: { ...base, kind: 'text', text: text.trim(), base64: null, mimetype: null } });
  }
}

return out;
