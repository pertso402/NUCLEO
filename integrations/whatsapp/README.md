# WhatsApp → NÚCLEO (sem n8n)

A Evolution API chama o app direto. Todo o resto é código: [`app/api/whatsapp/route.ts`](../../app/api/whatsapp/route.ts) e [`lib/whatsapp/`](../../lib/whatsapp/).

```
Evolution ──webhook──▶ /api/whatsapp?token=…  (200 na hora)
                         │ filtro: só o número do Peter, sem grupos/status/reenvios
                         ▼ depois da resposta (after)
                     áudio? → base64 do webhook (ou baixa na Evolution) → transcrição
                         ▼
                     runIngest (o mesmo pipeline do /api/ingest, registra em inbox_messages)
                         ▼
                     Evolution sendText → resposta no mesmo chat
```

## 1. Variáveis na Vercel (Production)
| variável | valor |
|---|---|
| `EVOLUTION_API_URL` | URL da Evolution, sem barra no fim |
| `EVOLUTION_API_KEY` | chave da Evolution (global ou da instância) |
| `EVOLUTION_INSTANCE` | nome da instância |
| `PETER_WHATSAPP_NUMBER` | seu número, `55DDDNUMERO`. Funciona com ou sem o 9 |
| `WHATSAPP_MODE` | `numero_separado` (padrão) ou `meu_numero` (veja abaixo) |
| `ELEVENLABS_API_KEY` | opcional: sem ela, o áudio é transcrito pela OpenAI (que já está configurada) |

`NUCLEO_API_TOKEN` e `OPENAI_API_KEY` já existem.

Os dois modos:
- `numero_separado`: a instância é um número só do NÚCLEO e você manda mensagem para ele.
- `meu_numero`: a instância é o seu próprio WhatsApp e você lança pelo chat "Mensagem para mim".

## 2. Webhook na instância da Evolution
- **URL:** `https://nucleo-beta.vercel.app/api/whatsapp?token=<NUCLEO_API_TOKEN>`. Se a sua Evolution aceitar headers no webhook, pode mandar `x-nucleo-token` em vez do `?token=`.
- **Webhook by Events:** desligado.
- **Webhook Base64:** ligado. Assim o áudio já chega junto; em algumas versões da Evolution, baixar áudio do iPhone depois falha.
- **Eventos:** só `MESSAGES_UPSERT`.

## 3. Teste
- `gastei 1 de teste` → `✅ Despesa R$ 1 …`
- `desfaz` → reverte
- Um áudio → a resposta começa com `🎙️ "o que foi entendido"`

## O que é ignorado em silêncio
- Outros números, grupos, status e canais.
- Mensagens com mais de 5 min, que a Evolution reenvia ao reconectar.
- O mesmo evento entregue duas vezes.
- As próprias respostas do NÚCLEO: começam com um caractere invisível (`U+2063`), o que evita loop no modo `meu_numero`.

## Depurar
- Tudo que passou pelo pipeline está em `inbox_messages`.
- Falhas de transcrição ou de envio aparecem nos logs da Vercel com o prefixo `whatsapp:`.
