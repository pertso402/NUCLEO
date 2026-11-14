import "server-only";
import type { WhatsAppMode } from "./webhook";

/** Configuração do WhatsApp vinda do ambiente. `null` = WhatsApp ainda não configurado. */
export function whatsappEnv(): {
  url: string;
  apiKey: string;
  instance: string;
  peterNumber: string;
  mode: WhatsAppMode;
} | null {
  const url = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  const peterNumber = process.env.PETER_WHATSAPP_NUMBER?.trim();
  if (!url || !apiKey || !instance || !peterNumber) return null;
  const mode: WhatsAppMode = process.env.WHATSAPP_MODE === "meu_numero" ? "meu_numero" : "numero_separado";
  return { url, apiKey, instance, peterNumber, mode };
}

type Env = NonNullable<ReturnType<typeof whatsappEnv>>;

async function evolution(env: Env, path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(`${env.url}${path}/${encodeURIComponent(env.instance)}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: env.apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Evolution ${path} respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function sendText(env: Env, number: string, text: string): Promise<void> {
  await evolution(env, "/message/sendText", { number, text }, 15_000);
}

/** Baixa o áudio quando ele não veio no webhook ("Webhook Base64" desligado). */
export async function fetchMediaBase64(env: Env, messageId: string): Promise<{ base64: string; mimetype: string | null }> {
  const r = (await evolution(
    env,
    "/chat/getBase64FromMediaMessage",
    { message: { key: { id: messageId } }, convertToMp4: false },
    15_000,
  )) as { base64?: string; mimetype?: string };
  if (!r.base64) throw new Error("Evolution não devolveu o áudio");
  return { base64: r.base64, mimetype: r.mimetype?.split(";")[0] ?? null };
}
