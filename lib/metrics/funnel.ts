/**
 * Funil reverso (ARCHITECTURE §6.3): do que falta no marco até "quantas abordagens por dia".
 * Puro, testável. Dinheiro em centavos.
 *
 *   contratos  = ceil(falta / ticket) − propostas abertas × r4
 *   propostas  = ceil(contratos / r4)
 *   reuniões   = ceil(propostas / r3)
 *   conversas  = ceil(reuniões / r2)
 *   abordagens = ceil(conversas / r1)
 *   por dia    = ceil(abordagens / dias úteis restantes)   (mínimo 1 se ainda falta algo)
 */

export type FunnelStage = "abordado" | "conversou" | "reuniao" | "proposta" | "fechado";
export type RateKey = "r1" | "r2" | "r3" | "r4";

/** r1 abordado→conversou · r2 conversou→reunião · r3 reunião→proposta · r4 proposta→fechado */
export const RATE_STEPS: { key: RateKey; from: FunnelStage; to: FunnelStage; label: string }[] = [
  { key: "r1", from: "abordado", to: "conversou", label: "abordagem → conversa" },
  { key: "r2", from: "conversou", to: "reuniao", label: "conversa → reunião" },
  { key: "r3", from: "reuniao", to: "proposta", label: "reunião → proposta" },
  { key: "r4", from: "proposta", to: "fechado", label: "proposta → fechado" },
];

export const DEFAULT_RATES: Record<RateKey, number> = { r1: 0.3, r2: 0.4, r3: 0.7, r4: 0.35 };
export const MIN_SAMPLE = 10;

const RANK: Record<string, number> = { abordado: 1, conversou: 2, reuniao: 3, proposta: 4, fechado: 5 };

export interface Rate {
  rate: number;
  /** Quantos leads passaram pela etapa de origem na janela. */
  sample: number;
  /** true = amostra < 10, usando a taxa padrão (`settings.default_conv_rates`). */
  estimated: boolean;
}
export type Rates = Record<RateKey, Rate>;

export interface StageEvent {
  lead_id: string;
  to_stage: string | null;
  created_at: string;
}

/** Lê `settings.default_conv_rates` com segurança (valores entre 0 e 1; o resto cai no padrão). */
export function parseDefaultRates(json: unknown): Record<RateKey, number> {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const pick = (k: RateKey) => {
    const n = Number(o[k]);
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_RATES[k];
  };
  return { r1: pick("r1"), r2: pick("r2"), r3: pick("r3"), r4: pick("r4") };
}

/**
 * Taxas por etapa a partir dos eventos de etapa da janela (90 dias). Para r_k: entre os leads
 * que estiveram na etapa k (entraram nela ou antes dela na janela), quantos chegaram a k+1 ou além.
 * Perdido não conta como avanço. Amostra < 10 → taxa padrão, marcada como estimada.
 */
/** Contagem crua por etapa na janela: quantos passaram pela etapa e quantos avançaram (base das taxas e das análises). */
export function stageCounts(
  events: readonly StageEvent[],
  now: Date,
  windowDays = 90,
): Record<RateKey, { sample: number; advanced: number }> {
  const since = now.getTime() - windowDays * 86_400_000;
  const span = new Map<string, { min: number; max: number }>();
  for (const e of events) {
    const r = e.to_stage ? RANK[e.to_stage] : undefined;
    if (!r || new Date(e.created_at).getTime() < since) continue;
    const cur = span.get(e.lead_id);
    span.set(e.lead_id, cur ? { min: Math.min(cur.min, r), max: Math.max(cur.max, r) } : { min: r, max: r });
  }
  const out = {} as Record<RateKey, { sample: number; advanced: number }>;
  for (const step of RATE_STEPS) {
    const k = RANK[step.from]!;
    let sample = 0;
    let advanced = 0;
    for (const sp of span.values()) {
      if (sp.min > k || sp.max < k) continue; // não passou pela etapa k na janela
      sample++;
      if (sp.max > k) advanced++;
    }
    out[step.key] = { sample, advanced };
  }
  return out;
}

export function computeRates(
  events: readonly StageEvent[],
  defaults: Record<RateKey, number>,
  now: Date,
  windowDays = 90,
  minSample = MIN_SAMPLE,
): Rates {
  const counts = stageCounts(events, now, windowDays);
  const out = {} as Rates;
  for (const step of RATE_STEPS) {
    const { sample, advanced } = counts[step.key];
    const estimated = sample < minSample;
    out[step.key] = { rate: estimated ? defaults[step.key] : advanced / sample, sample, estimated };
  }
  return out;
}

/** Ticket médio de mensalidade: fechados com valor nos últimos 180 dias; senão o padrão das configurações. */
export function averageTicket(
  closed: readonly { monthly_value_cents: number | null; closed_at: string | null }[],
  defaultTicketCents: number | null,
  now: Date,
  windowDays = 180,
): { ticketCents: number | null; sample: number; estimated: boolean } {
  const since = now.getTime() - windowDays * 86_400_000;
  const values = closed
    .filter((c) => c.monthly_value_cents && c.closed_at && new Date(c.closed_at).getTime() >= since)
    .map((c) => Number(c.monthly_value_cents));
  if (values.length) {
    return { ticketCents: Math.round(values.reduce((a, b) => a + b, 0) / values.length), sample: values.length, estimated: false };
  }
  return { ticketCents: defaultTicketCents, sample: 0, estimated: true };
}

export interface ReverseFunnel {
  /** Contratos que faltam pelo valor (antes de abater o que já está em proposta). */
  contractsNeeded: number;
  /** Contratos prováveis vindos das propostas abertas (propostas × r4). */
  pipelineCredit: number;
  contracts: number;
  proposals: number;
  meetings: number;
  conversations: number;
  outreach: number;
  perDay: number;
}

const safeCeil = (n: number) => (n <= 0 ? 0 : Math.ceil(n - 1e-9));

export function reverseFunnel(input: {
  remainingCents: number;
  ticketCents: number;
  rates: Record<RateKey, number>;
  openProposals: number;
  bdLeft: number;
}): ReverseFunnel {
  const { remainingCents, ticketCents, rates, openProposals } = input;
  const contractsNeeded = remainingCents > 0 && ticketCents > 0 ? safeCeil(remainingCents / ticketCents) : 0;
  const pipelineCredit = openProposals * rates.r4;
  const contracts = safeCeil(contractsNeeded - pipelineCredit);
  const proposals = safeCeil(contracts / rates.r4);
  const meetings = safeCeil(proposals / rates.r3);
  const conversations = safeCeil(meetings / rates.r2);
  const outreach = safeCeil(conversations / rates.r1);
  const perDay = outreach > 0 ? Math.max(1, safeCeil(outreach / Math.max(input.bdLeft, 1))) : 0;
  return { contractsNeeded, pipelineCredit, contracts, proposals, meetings, conversations, outreach, perDay };
}

/** Meta do dia: funil (mínimo 1) quando automática e calculável; marco coberto ou sem funil → a meta manual. */
export function dailyOutreachGoal(auto: boolean, manual: number, funnel: Pick<ReverseFunnel, "perDay"> | null): { value: number; auto: boolean } {
  if (auto && funnel && funnel.perDay > 0) return { value: funnel.perDay, auto: true };
  return { value: Math.max(manual, 0), auto: false };
}
