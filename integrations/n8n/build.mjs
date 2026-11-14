// Gera integrations/n8n/nucleo-whatsapp.json a partir de src/*.js.
// Uso: node integrations/n8n/build.mjs  (o teste tests/unit/n8n-whatsapp.test.ts confere se está em dia)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Normaliza CRLF (checkout no Windows) para o JSON sair igual em qualquer máquina.
const src = (f) => readFileSync(join(here, "src", f), "utf8").replace(/\r\n/g, "\n");

const CFG = "$('Config').first().json";
const MSG = "$('Filtrar mensagem do Peter').item.json";

/** Autenticação por header: a credencial (nome e valor) é escolhida no n8n ao importar. */
const headerAuth = { authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth" };

const nodes = [
  {
    id: "a1f0c001-0000-4000-8000-000000000001",
    name: "Webhook Evolution",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 300],
    webhookId: "6b0f5d8e-9a51-4c43-8f0e-6e7c2a1b9d01",
    parameters: { httpMethod: "POST", path: "nucleo-whatsapp", responseMode: "onReceived", options: {} },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000002",
    name: "Config",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [220, 300],
    parameters: {
      assignments: {
        assignments: [
          ["nucleo_url", "https://nucleo-beta.vercel.app"],
          ["evolution_url", "https://SUA-EVOLUTION.exemplo.com"],
          ["evolution_instancia", "NOME_DA_INSTANCIA"],
          ["numero_peter", "55DDDNUMERO"],
          ["modo", "numero_separado"],
          ["stt_modelo", "scribe_v2"],
        ].map(([name, value], i) => ({ id: `cfg-${i + 1}`, name, value, type: "string" })),
      },
      includeOtherFields: true,
      options: {},
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000003",
    name: "Filtrar mensagem do Peter",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [440, 300],
    parameters: { jsCode: src("filtro-whatsapp.js") },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000004",
    name: "É áudio?",
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [660, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [
          {
            id: "if-audio",
            leftValue: "={{ $json.kind }}",
            rightValue: "audio",
            operator: { type: "string", operation: "equals" },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000005",
    name: "Áudio veio junto?",
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position: [880, 160],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "if-base64",
            leftValue: "={{ $json.base64 }}",
            rightValue: "",
            operator: { type: "string", operation: "notEmpty", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000006",
    name: "Baixar áudio (Evolution)",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [1100, 260],
    parameters: {
      method: "POST",
      url: `={{ ${CFG}.evolution_url }}/chat/getBase64FromMediaMessage/{{ ${CFG}.evolution_instancia }}`,
      ...headerAuth,
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ message: { key: { id: $json.messageId } }, convertToMp4: false }) }}",
      options: { timeout: 15000 },
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000007",
    name: "Áudio em arquivo",
    type: "n8n-nodes-base.convertToFile",
    typeVersion: 1.1,
    position: [1320, 160],
    parameters: {
      operation: "toBinary",
      sourceProperty: "base64",
      options: { fileName: "audio.ogg", mimeType: "={{ $json.mimetype || 'audio/ogg' }}" },
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000008",
    name: "Transcrever (ElevenLabs)",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [1540, 160],
    parameters: {
      method: "POST",
      url: "https://api.elevenlabs.io/v1/speech-to-text",
      ...headerAuth,
      sendBody: true,
      contentType: "multipart-form-data",
      bodyParameters: {
        parameters: [
          { parameterType: "formBinaryData", name: "file", inputDataFieldName: "data" },
          { name: "model_id", value: `={{ ${CFG}.stt_modelo }}` },
          { name: "language_code", value: "por" },
          { name: "tag_audio_events", value: "false" },
        ],
      },
      options: { timeout: 20000 },
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-000000000009",
    name: "Lançar no NÚCLEO",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [1760, 300],
    parameters: {
      method: "POST",
      url: `={{ ${CFG}.nucleo_url }}/api/ingest`,
      ...headerAuth,
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={{ JSON.stringify({ channel: 'whatsapp', text: String($json.text || '').trim() || '(áudio vazio)', client_ts: ${MSG}.ts }) }}`,
      // Erro HTTP não derruba o fluxo: a resposta ainda volta pro WhatsApp com uma mensagem amigável.
      options: { timeout: 25000, response: { response: { neverError: true } } },
    },
  },
  {
    id: "a1f0c001-0000-4000-8000-00000000000a",
    name: "Montar resposta",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1980, 300],
    parameters: { mode: "runOnceForEachItem", jsCode: src("montar-resposta.js") },
  },
  {
    id: "a1f0c001-0000-4000-8000-00000000000b",
    name: "Responder no WhatsApp",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [2200, 300],
    parameters: {
      method: "POST",
      url: `={{ ${CFG}.evolution_url }}/message/sendText/{{ ${CFG}.evolution_instancia }}`,
      ...headerAuth,
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ number: $json.number, text: $json.text }) }}",
      options: { timeout: 15000 },
    },
  },
];

const to = (...names) => ({ main: names.map((n) => (n ? [{ node: n, type: "main", index: 0 }] : [])) });

const workflow = {
  name: "NÚCLEO · WhatsApp → ingest",
  nodes,
  connections: {
    "Webhook Evolution": to("Config"),
    Config: to("Filtrar mensagem do Peter"),
    "Filtrar mensagem do Peter": to("É áudio?"),
    "É áudio?": to("Áudio veio junto?", "Lançar no NÚCLEO"),
    "Áudio veio junto?": to("Áudio em arquivo", "Baixar áudio (Evolution)"),
    "Baixar áudio (Evolution)": to("Áudio em arquivo"),
    "Áudio em arquivo": to("Transcrever (ElevenLabs)"),
    "Transcrever (ElevenLabs)": to("Lançar no NÚCLEO"),
    "Lançar no NÚCLEO": to("Montar resposta"),
    "Montar resposta": to("Responder no WhatsApp"),
  },
  pinData: {},
  settings: { executionOrder: "v1", saveDataSuccessExecution: "none" },
  active: false,
  meta: { templateCredsSetupCompleted: false },
};

export function buildWorkflowJson() {
  return JSON.stringify(workflow, null, 2) + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(here, "nucleo-whatsapp.json"), buildWorkflowJson());
  console.log("integrations/n8n/nucleo-whatsapp.json gerado.");
}
