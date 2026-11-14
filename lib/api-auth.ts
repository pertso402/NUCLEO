import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Compara dois segredos em tempo constante (pelos hashes, então nem o tamanho vaza). */
export function safeEqual(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Confere o header `x-nucleo-token` contra `NUCLEO_API_TOKEN` em tempo constante. */
export function isValidApiToken(provided: string | null | undefined): boolean {
  return safeEqual(provided, process.env.NUCLEO_API_TOKEN);
}

/**
 * Rotas `/api/cron/*`: aceita `x-nucleo-token` (chamada manual) ou `Authorization: Bearer <segredo>`,
 * que é como o Vercel Cron autentica (usa `CRON_SECRET`). O Bearer também aceita o `NUCLEO_API_TOKEN`.
 */
export function isAuthorizedCron(headers: Headers): boolean {
  if (isValidApiToken(headers.get("x-nucleo-token"))) return true;
  const auth = headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return safeEqual(bearer, process.env.CRON_SECRET) || isValidApiToken(bearer);
}
