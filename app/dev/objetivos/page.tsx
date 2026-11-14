import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { GoalsView } from "@/components/goals/GoalsView";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Goal } from "@/lib/data/goals";
import { isQuarter } from "@/lib/metrics/goals";

/**
 * Vitrine de desenvolvimento da tela Objetivos com dados fictícios (404 em produção).
 * `?vazio=1` para o estado vazio, `?tri=2027-Q1` para outro trimestre. Não use os botões de salvar aqui: eles falam com o banco de verdade.
 */
const TODAY = "2026-11-13";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const goal = (n: number, p: Partial<Goal>): Goal => ({
  id: id(n),
  title: "",
  area: "dinheiro",
  why: null,
  quarter: "2026-Q4",
  target_date: null,
  status: "active",
  metric_label: null,
  metric_target: null,
  metric_current: null,
  position: n,
  tasks: [],
  ...p,
});

const GOALS: Goal[] = [
  goal(1, {
    title: "Fechar 5 clientes de mensalidade",
    area: "negocio",
    why: "Receita recorrente é o que me tira da montanha-russa todo mês.",
    metric_label: "clientes",
    metric_target: 5,
    metric_current: 2,
    target_date: "2026-12-20",
    tasks: [
      { id: id(101), title: "Mandar proposta pra Sorveteria Gelato", due_on: TODAY, status: "todo", moves_revenue: true },
      { id: id(102), title: "Follow-up Mercado Bom Preço", due_on: "2026-11-16", status: "todo", moves_revenue: true },
      { id: id(103), title: "Montar case do Choppatinhas", due_on: null, status: "done", moves_revenue: false },
    ],
  }),
  goal(2, {
    title: "Juntar R$ 10 mil de reserva",
    area: "dinheiro",
    why: "Seis meses de tranquilidade pra dizer não a cliente ruim.",
    metric_label: "mil",
    metric_target: 10,
    metric_current: 2.5,
  }),
  goal(3, {
    title: "Treinar 4x por semana",
    area: "saude",
    metric_label: "treinos",
    metric_target: 48,
    metric_current: 22,
    tasks: [{ id: id(104), title: "Renovar plano da academia", due_on: null, status: "todo", moves_revenue: false }],
  }),
  goal(4, { title: "Ler 6 livros", area: "aprendizado", metric_label: "livros", metric_target: 6, metric_current: 3 }),
  goal(5, { title: "Lançar site novo do portfólio", area: "negocio", status: "done" }),
  goal(6, { title: "Aprender inglês no Duolingo", area: "aprendizado", status: "dropped" }),
];

export default async function DevObjetivosPage(props: PageProps<"/dev/objetivos">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const tri = typeof sp.tri === "string" && isQuarter(sp.tri) ? sp.tri : "2026-Q4";
  const goals = sp.vazio === "1" || tri !== "2026-Q4" ? [] : GOALS;
  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <PageHeader title="Objetivos" kicker="Plano do trimestre" />
        <GoalsView goals={goals} quarter={tri} currentQuarter="2026-Q4" today={TODAY} base="/dev/objetivos" />
      </main>
    </>
  );
}
