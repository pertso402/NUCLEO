import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { Celebration } from "@/components/milestones/Celebration";
import { MarcosView } from "@/components/milestones/MarcosView";
import type { MilestoneRow, MilestonesOverview } from "@/lib/data/milestone";
import { formatMonthShort } from "@/lib/dates";
import { monthChoices } from "@/lib/metrics/milestones";
import { computePace } from "@/lib/metrics/pace";

/**
 * Vitrine de desenvolvimento da tela Marcos com dados fictícios (404 em produção).
 * `?celebrar=1` abre a celebração (`&n=2` para repetir, já que ela aparece uma vez por aparelho). Não use os botões de salvar aqui: eles falam com o banco de verdade.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { deadline: null, achieved_at: null, created_at: "2026-11-12T15:00:00Z", position: 0 } as const;

const row = (n: number, p: Partial<MilestoneRow>): MilestoneRow => ({
  ...base,
  id: id(n),
  title: "",
  metric: "revenue_month",
  target_cents: 0,
  period_start: null,
  period_end: null,
  status: "active",
  ...p,
});

const TODAY = "2026-11-13";
const NOW = new Date("2026-11-13T18:00:00Z");

const overview: MilestonesOverview = {
  active: [
    { ...row(1, { title: "R$ 10k de receita", target_cents: 1_000_000, period_start: "2026-11-01", period_end: "2026-11-30", deadline: "2026-11-30" }), currentCents: 620_000, pct: 0.62 },
    { ...row(2, { title: "Primeiros R$ 20k/mês", target_cents: 2_000_000, position: 1 }), currentCents: 620_000, pct: 0.31 },
    { ...row(3, { title: "R$ 100k acumulados", metric: "revenue_cumulative", target_cents: 10_000_000, deadline: "2027-06-30", position: 2 }), currentCents: 2_450_000, pct: 0.245 },
  ],
  achieved: [
    { ...row(4, { title: "Primeiro cliente fechado", target_cents: 150_000, status: "achieved", achieved_at: "2026-10-20T19:00:00Z", period_start: "2026-10-01" }), days: 20 },
    { ...row(5, { title: "R$ 5k no mês", target_cents: 500_000, status: "achieved", achieved_at: "2026-10-30T19:00:00Z", period_start: "2026-10-01" }), days: 30 },
  ].reverse(),
  archived: [row(6, { title: "R$ 3k de saldo", metric: "net_month", target_cents: 300_000, status: "archived" })],
};

export default async function DevMarcosPage(props: PageProps<"/dev/marcos">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const months = monthChoices(TODAY).map((m) => ({ value: m.slice(0, 7), label: `${formatMonthShort(m)}/${m.slice(0, 4)}` }));
  const pace = computePace({
    currentCents: 620_000,
    targetCents: 1_000_000,
    period: { start: "2026-11-01", end: "2026-11-30" },
    now: NOW,
  });
  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <MarcosView
          highlight={{ milestone: { id: id(1), title: "R$ 10k de receita", metricLabel: "Receita do mês", deadline: "2026-11-30" }, pace }}
          overview={sp.vazio === "1" ? { active: [], achieved: [], archived: [] } : overview}
          months={months}
          today={TODAY}
        />
      </main>
      {sp.celebrar === "1" && (
        <Celebration
          items={[
            {
              id: `dev-${typeof sp.n === "string" ? sp.n : "1"}`, // ?n=2, 3… para ver de novo
              title: "R$ 10k de receita",
              targetCents: 1_000_000,
              currentCents: 1_045_000,
              achievedAt: "2026-11-27T20:00:00Z",
              days: 27,
            },
          ]}
        />
      )}
    </>
  );
}
