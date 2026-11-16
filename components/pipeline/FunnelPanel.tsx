"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { Money } from "@/components/hud/Money";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FunnelData } from "@/lib/data/funnel";
import { RATE_STEPS, type RateKey } from "@/lib/metrics/funnel";
import { setDefaultTicket } from "@/app/(app)/pipeline/actions";

const pct = (r: number) => `${Math.round(r * 100)}%`;
const n1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Painel do funil reverso (ARCHITECTURE §6.3): do que falta no marco até as abordagens de hoje.
 * Taxas com amostra < 10 aparecem como "estimado" (vêm das configurações).
 */
export function FunnelPanel({ data }: { data: FunnelData }) {
  const { milestone, funnel, rates, ticket } = data;

  if (!milestone) {
    return (
      <HudCard label="Funil reverso" accent="ion">
        <p className="text-sm text-text-2">
          Crie um marco (de preferência de mensalidades) pra calcular quantas abordagens por dia você precisa.{" "}
          <Link href="/marcos" className="text-ion underline underline-offset-4">
            Criar marco →
          </Link>
        </p>
      </HudCard>
    );
  }

  if (!ticket.ticketCents) {
    return (
      <HudCard label="Funil reverso" accent="ion">
        <TicketForm />
      </HudCard>
    );
  }

  const chain: { label: string; value: number; rate?: RateKey }[] = funnel
    ? [
        { label: "Abordagens", value: funnel.outreach, rate: "r1" },
        { label: "Conversas", value: funnel.conversations, rate: "r2" },
        { label: "Reuniões", value: funnel.meetings, rate: "r3" },
        { label: "Propostas", value: funnel.proposals, rate: "r4" },
        { label: "Contratos", value: funnel.contracts },
      ]
    : [];
  const anyEstimated = RATE_STEPS.some((s) => rates[s.key].estimated);

  return (
    <HudCard
      label="Funil reverso"
      accent="ion"
      action={
        <span className="num text-xs text-text-2">
          ticket <Money cents={ticket.ticketCents} showCents={false} className="text-xs" />
          /mês{ticket.estimated ? " · estimado" : ` · média de ${ticket.sample}`}
        </span>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="shrink-0">
          <p className="text-xs text-text-2">Hoje</p>
          <p className="num text-4xl font-medium text-ion [text-shadow:0_0_16px_rgba(46,230,255,0.55)]">
            {funnel?.perDay ?? 0}
            <span className="ml-1.5 text-base text-text-1">abordagens</span>
          </p>
          <p className="mt-1 text-xs text-text-2">
            Faltam <Money cents={milestone.remainingCents} showCents={false} className="text-xs" /> em {milestone.title} ·{" "}
            {milestone.bdLeft} {milestone.bdLeft === 1 ? "dia útil" : "dias úteis"}
          </p>
          {milestone.metric !== "mrr" && (
            <p className="mt-1 text-xs text-text-2">Sem marco de mensalidades: cada contrato conta como 1 mês do ticket.</p>
          )}
        </div>

        {funnel && funnel.contracts === 0 ? (
          <p className="text-sm text-volt">
            {milestone.remainingCents === 0
              ? "Marco coberto. Mantenha o ritmo de abordagens."
              : "As propostas abertas já cobrem o que falta. Foco nos follow-ups."}
          </p>
        ) : (
          <ol className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-5 sm:gap-0" aria-label="Funil do marco até hoje">
            {chain.map((step, i) => (
              <li key={step.label} className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-1">
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-baseline justify-between gap-2 rounded-sm border px-3 py-2 sm:flex-col sm:items-center sm:justify-center sm:text-center",
                    i === 0 ? "border-ion/50 bg-ion/10" : "border-line bg-white/[0.02]",
                  )}
                >
                  <span className="text-xs text-text-2">{step.label}</span>
                  <span className={cn("num text-lg", i === 0 ? "text-ion" : "text-text-0")}>{step.value}</span>
                </div>
                {step.rate && (
                  <span
                    className={cn(
                      "num flex shrink-0 items-center gap-0.5 text-[11px] sm:justify-center",
                      rates[step.rate].estimated ? "text-text-2" : "text-text-1",
                    )}
                    title={`${RATE_STEPS.find((s) => s.key === step.rate)!.label}: ${rates[step.rate].sample} leads na amostra`}
                  >
                    {pct(rates[step.rate].rate)}
                    <ChevronRight size={12} strokeWidth={1.5} className="hidden sm:inline" aria-hidden />
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="mt-3 text-xs text-text-2">
        {data.openProposals > 0 && (
          <>
            {data.openProposals} {data.openProposals === 1 ? "proposta aberta" : "propostas abertas"} ≈{" "}
            {n1.format(funnel?.pipelineCredit ?? 0)} contrato já abatido.{" "}
          </>
        )}
        {anyEstimated && "Taxas em cinza são estimadas (menos de 10 leads na amostra dos últimos 90 dias)."}
      </p>
    </HudCard>
  );
}

function TicketForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await setDefaultTicket(value);
      if (!r.ok) setError(r.error);
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="text-sm text-text-1">Quanto vale um contrato por mês, em média? É o que transforma o marco em contratos.</p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: 900"
          inputMode="decimal"
          aria-label="Ticket médio por mês"
          className="num h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-ion/60 focus:outline-none"
        />
        <Button type="submit" disabled={pending || !value.trim()} className="shrink-0">
          Salvar
        </Button>
      </div>
      {error && <p className="text-sm text-flare">{error}</p>}
      <p className="text-xs text-text-2">Quando você fechar contratos com valor, o NÚCLEO passa a usar a média real.</p>
    </form>
  );
}
