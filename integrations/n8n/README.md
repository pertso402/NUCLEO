# n8n · WhatsApp → NÚCLEO

O fluxo `nucleo-whatsapp.json` faz a ponte entre o WhatsApp e o app. Toda a regra de negócio fica no app (`/api/ingest`).

```
Evolution (webhook) → Config → Filtrar mensagem do Peter → É áudio?
   texto ─────────────────────────────────────────────┐
   áudio → (base64 veio junto? senão baixa da Evolution)│
         → arquivo → ElevenLabs Scribe (pt) ───────────┤
                                                       ▼
                       Lançar no NÚCLEO (/api/ingest, channel "whatsapp")
                       → Montar resposta → Responder no WhatsApp (Evolution sendText)
```

## Instalação (uma vez)

1. **Credenciais no n8n.** Crie três credenciais do tipo *Header Auth*:
   | Nome da credencial | Name (header) | Value |
   |---|---|---|
   | NÚCLEO token | `x-nucleo-token` | o mesmo `NUCLEO_API_TOKEN` da Vercel |
   | Evolution API | `apikey` | a chave da Evolution (global ou da instância) |
   | ElevenLabs | `xi-api-key` | a chave da ElevenLabs |
2. **Importar o fluxo.** Vá em *Workflows → Import from file → `nucleo-whatsapp.json`*. Depois escolha a credencial certa nos 4 nós HTTP:
   - *Baixar áudio* e *Responder no WhatsApp*: Evolution API.
   - *Transcrever*: ElevenLabs.
   - *Lançar no NÚCLEO*: NÚCLEO token.
3. **Preencher o nó Config:**
   - `nucleo_url`: `https://nucleo-beta.vercel.app`.
   - `evolution_url`: a URL da Evolution, sem barra no fim.
   - `evolution_instancia`: o nome da instância.
   - `numero_peter`: o seu número no formato `55DDDNUMERO`. Funciona com ou sem o 9.
   - `modo`:
     - `numero_separado` (padrão) se a instância é um número só do NÚCLEO e você manda mensagem para ele.
     - `meu_numero` se a instância é o seu próprio WhatsApp e você lança pelo chat "Mensagem para mim".
   - `stt_modelo`: `scribe_v2` (ou `scribe_v1`).
4. **Ativar o fluxo** e copiar a *Production URL* do nó *Webhook Evolution*. Ela termina em `/webhook/nucleo-whatsapp`.
5. **Configurar o webhook na Evolution.** Na instância, aponte o webhook para essa URL e configure assim:
   - **Webhook by Events:** desligado.
   - **Webhook Base64:** ligado. O download separado falha com áudio do iPhone em algumas versões da Evolution, e com o base64 no webhook o fluxo não precisa baixar nada.
   - **Eventos:** só `MESSAGES_UPSERT`.

## Teste
- Mande `gastei 1 de teste`. Deve chegar `✅ Despesa R$ 1 …`.
- Mande `desfaz` para reverter.
- Mande um áudio. A resposta começa com `🎙️ "o que foi entendido"`.

## O que é descartado em silêncio
- Grupos, status e canais.
- Qualquer outro número.
- Mensagens com mais de 5 minutos, que a Evolution reenvia ao reconectar.
- As próprias respostas do NÚCLEO. Elas começam com um caractere invisível (`U+2063`), o que evita loop no modo `meu_numero`.

## Depurar
- Tudo que chega ao app fica em `inbox_messages`.
- O fluxo não salva execuções com sucesso, porque o áudio em base64 pesa. Para investigar, mude em *Workflow settings → Save successful executions*.

## Editar o fluxo
- O código dos nós Code fica em `src/`. Depois de mexer, rode `node integrations/n8n/build.mjs`. O teste `tests/unit/n8n-whatsapp.test.ts` falha se o JSON estiver desatualizado.
- Se você mudar algo direto no n8n, exporte de novo para cá.
