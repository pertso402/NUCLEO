import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Confere o header `x-nucleo-token` contra `NUCLEO_API_TOKEN` em tempo constante.
 * Compara os hashes (tamanho fixo), então nem o comprimento do token vaza.
 */
export function isValidApiToken(provided: string | null | undefined): boolean {
  const expected = process.env.NUCLEO_API_TOKEN;
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
