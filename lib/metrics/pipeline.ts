/**
 * Regras do quadro do pipeline (puro, testável). Datas ISO em São Paulo; dinheiro em centavos.
 */
import { addDays, weekday, type ISODate } from "@/lib/dates";

export type LeadStage = "abordado" | "conversou" | "reuniao" | "proposta" | "fechado" | "perdido";
export type LostReason = "preco" | "timing" | "sem_resposta" | "concorrente" | "nao_viu_valor" | "outro";
export type LeadOrigin = "indicacao" | "abordagem_fria" | "instagram" | "evento" | "cliente_atual" | "outro";

export const STAGES: { value: LeadStage; label: string }[] = [
  { value: "abordado", label: "Abordado" },
  { value: "conversou", label: "Conversou" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta", label: "Proposta" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<LeadStage, string>;

export const LOST_REASONS: { value: LostReason; label: string }[] = [
  { value: "preco", label: "Preço" },
  { value: "timing", label: "Timing" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "concorrente", label: "Concorrente" },
  { value: "nao_viu_valor", label: "Não viu valor" },
  { value: "outro", label: "Outro" },
];

export const ORIGINS: { value: LeadOrigin; label: string }[] = [
  { value: "abordagem_fria", label: "Abordagem fria" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "evento", label: "Evento" },
  { value: "cliente_atual", label: "Cliente atual" },
  { value: "outro", label: "Outro" },
];

export const isLive = (s: LeadStage) => s !== "fechado" && s !== "perdido";

/** Próxima etapa do funil (botão "Avançar" no mobile). Fechado/perdido não avançam. */
export function nextStage(s: LeadStage): LeadStage | null {
  const order: LeadStage[] = ["abordado", "conversou", "reuniao", "proposta", "fechado"];
  const i = order.indexOf(s);
  return i >= 0 && i < order.length - 1 ? order[i + 1]! : null;
}

export interface BoardLead {
  id: string;
  name: string;
  business: string | null;
  stage: LeadStage;
  next_action: string | null;
  next_action_on: ISODate | null;
  monthly_value_cents: number | null;
  stage_changed_at: string;
}

/** Atrasado = vivo e com próxima ação antes de hoje (ARCHITECTURE §6.4). */
export function isOverdue(l: Pick<BoardLead, "stage" | "next_action_on">, today: ISODate): boolean {
  return isLive(l.stage) && !!l.next_action_on && l.next_action_on < today;
}

/** Proposta parada há 7+ dias sem mudar de etapa → sugerir follow-up. */
export function isStaleProposal(l: Pick<BoardLead, "stage" | "stage_changed_at">, now: Date): boolean {
  return l.stage === "proposta" && now.getTime() - new Date(l.stage_changed_at).getTime() >= 7 * 86_400_000;
}

/** Colunas na ordem do funil: vivos por próxima ação (atrasados primeiro); fechados/perdidos pelos mais recentes. */
export function buildColumns<T extends BoardLead>(leads: readonly T[]) {
  return STAGES.map((s) => {
    const items = leads.filter((l) => l.stage === s.value);
    items.sort((a, b) =>
      isLive(s.value)
        ? (a.next_action_on ?? "9999").localeCompare(b.next_action_on ?? "9999") || a.name.localeCompare(b.name, "pt-BR")
        : b.stage_changed_at.localeCompare(a.stage_changed_at),
    );
    return {
      stage: s.value,
      label: s.label,
      items,
      count: items.length,
      monthlyCents: items.reduce((sum, l) => sum + (l.monthly_value_cents ?? 0), 0),
    };
  });
}

/** Link de WhatsApp a partir do telefone digitado (BR sem DDI ganha 55). */
export function whatsappLink(phone: string | null | undefined): string | null {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith("55") && d.length >= 12 ? d : `55${d}`}`;
}

/** Próximo dia útil (seg–sex) a partir de amanhã: prazo padrão quando não foi dito quando. */
export function nextBusinessDay(today: ISODate): ISODate {
  let d = addDays(today, 1);
  while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1);
  return d;
}
