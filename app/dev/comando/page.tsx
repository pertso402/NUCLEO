import { notFound } from "next/navigation";
import { ComandoView } from "@/components/command/ComandoView";
import { GridBackground } from "@/components/hud/GridBackground";
import { MilestoneHero } from "@/components/hud/MilestoneHero";
import type { TodayData } from "@/lib/data/today";
import { computePace } from "@/lib/metrics/pace";
import { computeScore } from "@/lib/metrics/score";

/**
 * Vitrine de desenvolvimento do Comando, com dados fictícios. Só existe em `next dev` (404 em produção).
 * Padrão: o hero em vários estados. `?tela=1`: a tela inteira (faixa Hoje, tarefas, princípio);
 * `&vazio=1` para o dia sem nada. Não use os botões de salvar aqui: eles falam com o banco de verdade.
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

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function fakeToday(empty: boolean): TodayData {
  const input = empty
    ? { revenueTasksPlanned: 0, revenueTasksDone: 0, focusMinutes: 0, habitsExpected: 0, habitsDone: 0 }
    : { revenueTasksPlanned: 3, revenueTasksDone: 1, focusMinutes: 165, habitsExpected: 3, habitsDone: 2 };
  return {
    today: "2026-11-13",
    workday: true,
    score: computeScore({ workday: true, outreachDone: null, outreachGoal: null, focusGoalMinutes: 240, ...input }),
    focusMinutes: input.focusMinutes,
    focusGoalMinutes: 240,
    habitsExpected: input.habitsExpected,
    habitsDone: input.habitsDone,
    revenueTasks: empty
      ? []
      : [
          { id: id(1), title: "Cobrar parcela do Choppatinhas", due_on: "2026-11-11" },
          { id: id(2), title: "Mandar proposta pra Sorveteria Gelato", due_on: "2026-11-13" },
          { id: id(3), title: "Follow-up Mercado Bom Preço", due_on: "2026-11-16" },
        ],
    revenueDoneToday: input.revenueTasksDone,
    principle: empty ? null : { id: id(9), text: "Proposta enviada hoje vale mais que proposta perfeita semana que vem." },
  };
}

export default async function DevComandoPage(props: PageProps<"/dev/comando">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;

  if (sp.tela === "1") {
    const empty = sp.vazio === "1";
    return (
      <>
        <GridBackground />
        <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
          <ComandoView
            highlight={{
              milestone: { id: id(10), ...milestone },
              pace: computePace({ currentCents: empty ? 0 : 620_050, targetCents: 1_000_000, period: NOV, now: NOW }),
            }}
            today={fakeToday(empty)}
            hour={15}
          />
        </main>
      </>
    );
  }

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
