/* global $, $json */
// NÚCLEO · nó "Montar resposta" (Code, rodar uma vez para cada item).
// Recebe a resposta do /api/ingest e monta o texto que volta no WhatsApp.
// Fonte: integrations/n8n/src/montar-resposta.js (o JSON é gerado por build.mjs).
const MARK = '⁣'; // marca invisível: o filtro ignora mensagens que começam com ela
const msg = $('Filtrar mensagem do Peter').item.json;

let reply =
  typeof $json.reply_text === 'string' && $json.reply_text.trim()
    ? $json.reply_text.trim()
    : 'Não consegui processar agora. Tenta de novo em texto.';

if (msg.kind === 'audio') {
  const stt = $('Transcrever (ElevenLabs)');
  const heard = stt.isExecuted ? String(stt.item.json.text ?? '').trim() : '';
  // Ecoa o que foi entendido: se a transcrição errar, o Peter vê na hora e manda "desfaz".
  reply = heard ? `🎙️ "${heard}"\n${reply}` : 'Não entendi o áudio. Pode mandar de novo ou escrever?';
}

return { json: { number: msg.number, text: MARK + reply } };
