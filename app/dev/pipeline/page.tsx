import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Lead } from "@/lib/data/pipeline";

/**
 * Vitrine do Pipeline com leads fictícios (404 em produção). `?vazio=1` para o quadro vazio.
 * Não use os botões de salvar/arrastar aqui: eles falam com o banco de verdade.
 */
const TODAY = "2026-11-16";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lead = (n: number, p: Partial<Lead>): Lead => ({
  id: id(n),
  name: "",
  business: null,
  phone: null,
  segment: null,
  origin: "abordagem_fria",
  stage: "abordado",
  monthly_value_cents: null,
  setup_value_cents: null,
  next_action: "Fazer follow-up",
  next_action_on: "2026-11-18",
  lost_reason: null,
  contract_status: null,
  stage_changed_at: "2026-11-12T15:00:00Z",
  closed_at: null,
  notes: null,
  created_at: "2026-11-01T12:00:00Z",
  ...p,
});

const LEADS: Lead[] = [
  lead(1, { name: "João", business: "Padaria Pão Quente", next_action: "Ligar de novo", next_action_on: "2026-11-19", phone: "11987654321" }),
  lead(2, { name: "Rafa", business: "Hamburgueria Brasa", next_action: "Mandar vídeo do cardápio", next_action_on: "2026-11-13" }),
  lead(3, { name: "Ana", business: "Açaí Tropical", stage: "conversou", next_action: "Marcar reunião", next_action_on: TODAY }),
  lead(4, { name: "Pizzaria Forno", stage: "reuniao", next_action: "Reunião", next_action_on: "2026-11-17", monthly_value_cents: 80_000 }),
  lead(5, {
    name: "Mercado Bom Preço",
    stage: "proposta",
    next_action: "Cobrar retorno",
    next_action_on: "2026-11-20",
    monthly_value_cents: 120_000,
    stage_changed_at: "2026-11-05T15:00:00Z",
  }),
  lead(6, {
    name: "Choppatinhas",
    stage: "fechado",
    next_action: null,
    next_action_on: null,
    monthly_value_cents: 90_000,
    contract_status: "ativo",
    stage_changed_at: "2026-11-03T15:00:00Z",
  }),
  lead(7, { name: "Sorveteria Gelato", stage: "perdido", next_action: null, next_action_on: null, lost_reason: "preco" }),
];

export default async function DevPipelinePage(props: PageProps<"/dev/pipeline">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <PageHeader title="Pipeline" kicker="Leads e próximos passos" />
        <PipelineBoard leads={sp.vazio === "1" ? [] : LEADS} today={TODAY} nowIso="2026-11-16T15:00:00Z" />
      </main>
    </>
  );
}
