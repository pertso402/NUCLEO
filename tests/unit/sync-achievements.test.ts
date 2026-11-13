import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAchievements } from "@/lib/data/milestone";

/** Supabase falso: guarda linhas em memória e entende só o que o syncAchievements usa. */
function fakeSupabase(tables: { milestones: Record<string, unknown>[]; transactions: Record<string, unknown>[] }) {
  const updates: { id: unknown; patch: Record<string, unknown> }[] = [];
  const from = (table: "milestones" | "transactions") => {
    const filters: [string, string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    const rows = () =>
      tables[table].filter((r) =>
        filters.every(([op, col, v]) =>
          op === "eq" ? r[col] === v : op === "gte" ? String(r[col]) >= String(v) : String(r[col]) <= String(v),
        ),
      );
    const builder = {
      select: () => builder,
      eq: (c: string, v: unknown) => (filters.push(["eq", c, v]), builder),
      gte: (c: string, v: unknown) => (filters.push(["gte", c, v]), builder),
      lte: (c: string, v: unknown) => (filters.push(["lte", c, v]), builder),
      update: (p: Record<string, unknown>) => ((patch = p), builder),
      then: (resolve: (r: { data: unknown; error: null }) => void) => {
        const hit = rows();
        if (patch) {
          for (const r of hit) {
            Object.assign(r, patch);
            updates.push({ id: r.id, patch });
          }
          return resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
        }
        return resolve({ data: hit.map((r) => ({ ...r })), error: null });
      },
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, updates };
}

const NOW = new Date("2026-11-20T18:00:00Z");
const ms = (p: Record<string, unknown>) => ({
  user_id: "u1",
  status: "active",
  period_start: "2026-11-01",
  period_end: "2026-11-30",
  deadline: null,
  achieved_at: null,
  position: 0,
  created_at: "2026-11-12T15:00:00Z",
  ...p,
});
const tx = (p: Record<string, unknown>) => ({ user_id: "u1", status: "confirmed", kind: "income", ...p });

describe("syncAchievements", () => {
  it("marca só o que bateu a meta, com data e dias", async () => {
    const { client, updates } = fakeSupabase({
      milestones: [
        ms({ id: "m1", title: "R$ 1k", metric: "revenue_month", target_cents: "100000" }),
        ms({ id: "m2", title: "R$ 10k", metric: "revenue_month", target_cents: "1000000" }),
        ms({ id: "m3", title: "Saldo R$ 500", metric: "net_month", target_cents: "50000" }),
        ms({ id: "m4", title: "MRR", metric: "mrr", target_cents: "1" }),
      ],
      transactions: [
        tx({ occurred_on: "2026-11-05", amount_cents: "80000" }),
        tx({ occurred_on: "2026-11-18", amount_cents: "30000" }),
        tx({ occurred_on: "2026-11-19", amount_cents: "70000", kind: "expense" }),
        tx({ occurred_on: "2026-11-19", amount_cents: "999999", status: "pending_review" }),
        tx({ occurred_on: "2026-10-30", amount_cents: "999999" }),
      ],
    });
    const got = await syncAchievements(client, { userId: "u1", now: NOW });
    // receita do mês = 1.100 ≥ 1.000 ✓ · 10k ✗ · saldo = 1.100 − 700 = 400 < 500 ✗ · mrr nunca
    expect(got).toEqual([
      { id: "m1", title: "R$ 1k", targetCents: 100000, currentCents: 110000, achievedAt: NOW.toISOString(), days: 20 },
    ]);
    expect(updates).toEqual([{ id: "m1", patch: { status: "achieved", achieved_at: NOW.toISOString() } }]);
  });

  it("não marca de novo o que já foi batido", async () => {
    const { client } = fakeSupabase({
      milestones: [ms({ id: "m1", title: "R$ 1k", metric: "revenue_month", target_cents: "100000" })],
      transactions: [tx({ occurred_on: "2026-11-05", amount_cents: "200000" })],
    });
    expect(await syncAchievements(client, { userId: "u1", now: NOW })).toHaveLength(1);
    expect(await syncAchievements(client, { userId: "u1", now: NOW })).toHaveLength(0);
  });
});
