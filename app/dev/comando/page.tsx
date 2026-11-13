import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { MilestoneHero } from "@/components/hud/MilestoneHero";
import { computePace } from "@/lib/metrics/pace";

/**
 * Vitrine de desenvolvimento: o hero do Comando em vários estados, com dados fictícios.
 * Só existe em `next dev` (404 em produção) e não precisa de login.
 */
const NOV = { start: "2026-11-01", end: "2026-11-30" };
const NOW = new Date("2026-11-13T18:00:00Z"); // sexta, 15h em SP
const milestone = { title: "R$ 10k de receita", metricLabel: "Receita do mês", deadline: "2026-11-30" };

const states = [
  { label: "Começando do zero", current: 0 },
  { label: "Abaixo do ritmo", current: 250_000 },
  { label: "No ritmo", current: 620_050 },
  { label: "Marco batido", current: 1_050_000 },
];

export default function DevComandoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <GridBackground />
      <main className="mx-auto grid max-w-content gap-6 px-4 py-6 lg:grid-cols-2 lg:px-8">
        {states.map((s) => (
          <section key={s.label} className="flex flex-col gap-2">
            <p className="label-instrument">{s.label}</p>
            <MilestoneHero
              milestone={milestone}
              pace={computePace({ currentCents: s.current, targetCents: 1_000_000, period: NOV, now: NOW })}
            />
          </section>
        ))}
      </main>
    </>
  );
}
