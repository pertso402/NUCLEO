/**
 * Limite simples por janela deslizante, em memória (ARCHITECTURE §5.3: 30 req/min no ingest).
 * Em serverless cada instância tem o seu contador — serve como freio contra loop/abuso,
 * não como garantia exata. Usuário único, então a chave é só o canal.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterMs: windowMs - (now - (recent[0] ?? now)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterMs: 0 };
}

/** Só para testes. */
export function resetRateLimit() {
  hits.clear();
}
