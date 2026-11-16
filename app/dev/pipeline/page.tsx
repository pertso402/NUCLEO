import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { FunnelPanel } from "@/components/pipeline/FunnelPanel";
import { PipelineAnalytics } from "@/components/pipeline/PipelineAnalytics";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import type { FunnelData } from "@/lib/data/funnel";
import { computeRates, DEFAULT_RATES, reverseFunnel } from "@/lib/metrics/funnel";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Lead } from "@/lib/data/pipeline";

/**
 * Vitrine do Pipeline com leads fictícios (404 em produção). `?vazio=1` para o quadro vazio;
 * `?funil=semticket|semmarco` para os estados do painel do funil.
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

const rates = computeRates([], DEFAULT_RATES, new Date("2026-11-16T15:00:00Z"));
function fakeFunnel(mode: string | undefined): FunnelData {
  const milestone = { title: "R$ 10k de mensalidades", metric: "mrr", currentCents: 90_000, targetCents: 1_000_000, remainingCents: 910_000, bdLeft: 10 };
  const ticket = mode === "semticket" ? { ticketCents: null, sample: 0, estimated: true } : { ticketCents: 90_000, sample: 1, estimated: false };
  const funnel = ticket.ticketCents ? reverseFunnel({ remainingCents: milestone.remainingCents, ticketCents: ticket.ticketCents, rates: DEFAULT_RATES, openProposals: 1, bdLeft: 10 }) : null;
  return { milestone: mode === "semmarco" ? null : milestone, rates, ticket, openProposals: 1, funnel, dailyGoal: { value: funnel?.perDay ?? 5, auto: true } };
}

export default async function DevPipelinePage(props: PageProps<"/dev/pipeline">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <PageHeader title="Pipeline" kicker="Leads e próximos passos" />
        <div className="flex flex-col gap-5">
          <FunnelPanel data={fakeFunnel(typeof sp.funil === "string" ? sp.funil : undefined)} />
          <PipelineBoard leads={sp.vazio === "1" ? [] : LEADS} today={TODAY} nowIso="2026-11-16T15:00:00Z" />
          <PipelineAnalytics
            data={{
              stages: { r1: { sample: 40, advanced: 13 }, r2: { sample: 14, advanced: 6 }, r3: { sample: 6, advanced: 4 }, r4: { sample: 4, advanced: 2 } },
              lost: { total: 7, items: [ { reason: "preco", count: 3, share: 3 / 7 }, { reason: "sem_resposta", count: 2, share: 2 / 7 }, { reason: "timing", count: 1, share: 1 / 7 }, { reason: "concorrente", count: 1, share: 1 / 7 } ] },
              origins: [
                { origin: "indicacao", leads: 6, closed: 3, closeRate: 0.5, mrrCents: 270_000 },
                { origin: "abordagem_fria", leads: 30, closed: 2, closeRate: 2 / 30, mrrCents: 170_000 },
                { origin: "instagram", leads: 8, closed: 0, closeRate: 0, mrrCents: 0 },
              ],
            }}
          />
        </div>
      </main>
    </>
  );
}
