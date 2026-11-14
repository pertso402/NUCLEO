import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

/**
 * Supabase em memória, só o suficiente para os testes do ingest: insert/select/update/delete,
 * filtros eq/neq/is/in/gte/lt, order/limit, single/maybeSingle. Gera `id` e respeita as
 * chaves únicas passadas em `unique` (erro 23505, como o Postgres) e os `defaults` das colunas.
 */
export function fakeSupabase(
  seed: Record<string, Row[]> = {},
  unique: Record<string, string[]> = {},
  /** Valores padrão das colunas (como o DEFAULT do Postgres). */
  defaults: Record<string, Row> = {},
) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  let seq = 0;
  const log: { table: string; op: string; payload?: unknown }[] = [];

  const from = (table: string) => {
    tables[table] ??= [];
    const filters: Filter[] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let limitN: number | null = null;
    let one: "single" | "maybe" | null = null;
    let returning = false;

    const run = (): { data: unknown; error: { message: string; code?: string } | null } => {
      const rows = tables[table]!;
      if (op === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload!]).map((r): Row => ({ id: `${table}-${++seq}`, ...defaults[table], ...r }));
        for (const r of list) {
          for (const key of [unique[table] ?? []]) {
            if (key.length && rows.some((x) => key.every((k) => x[k] === r[k]))) {
              return { data: null, error: { message: "duplicate key", code: "23505" } };
            }
          }
          rows.push(r);
        }
        log.push({ table, op, payload });
        const out = list.map((r) => ({ ...r }));
        return { data: one ? out[0] ?? null : returning ? out : null, error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        for (const r of hit) Object.assign(r, payload);
        log.push({ table, op, payload: { ids: hit.map((r) => r.id), patch: payload } });
        return { data: null, error: null };
      }
      if (op === "delete") {
        tables[table] = rows.filter((r) => !hit.includes(r));
        log.push({ table, op, payload: { ids: hit.map((r) => r.id) } });
        return { data: null, error: null };
      }
      const out = (limitN === null ? hit : hit.slice(0, limitN)).map((r) => ({ ...r }));
      if (one === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "not single" } };
      if (one === "maybe") return { data: out[0] ?? null, error: null };
      return { data: out, error: null };
    };

    const b = {
      select: () => ((returning = true), b),
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), b),
      update: (p: Row) => ((op = "update"), (payload = p), b),
      delete: () => ((op = "delete"), b),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
      gte: (c: string, v: unknown) => (filters.push((r) => String(r[c]) >= String(v)), b),
      lt: (c: string, v: unknown) => (filters.push((r) => String(r[c]) < String(v)), b),
      order: () => b,
      limit: (n: number) => ((limitN = n), b),
      single: () => ((one = "single"), b),
      maybeSingle: () => ((one = "maybe"), b),
      then: (resolve: (r: ReturnType<typeof run>) => unknown, reject?: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(resolve(run()));
        } catch (e) {
          return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
        }
      },
    };
    return b;
  };

  return { client: { from } as unknown as SupabaseClient, tables, log };
}
