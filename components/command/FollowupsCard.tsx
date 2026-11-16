"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { cn } from "@/lib/cn";
import type { Followup } from "@/lib/data/followups";
import { daysSince, nextBusinessDay, whatsappLink } from "@/lib/metrics/pipeline";
import { completeFollowup } from "@/app/(app)/pipeline/actions";

/**
 * Follow-ups do dia no Comando (ARCHITECTURE §7.1, §6.4): atrasados em Ember, os de hoje e propostas
 * paradas há 7+ dias. "Feito" registra o follow-up e já pede o próximo passo.
 */
export function FollowupsCard({ items, today, nowIso }: { items: Followup[]; today: string; nowIso: string }) {
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const visible = items.filter((f) => !doneIds.includes(f.lead.id));
  const late = visible.filter((f) => f.kind === "overdue").length;
  const now = new Date(nowIso);

  return (
    <HudCard
      label="Follow-ups"
      accent={late ? "none" : "ion"}
      action={
        <Link href="/pipeline" className="text-xs text-text-2 transition-colors hover:text-text-0">
          Pipeline →
        </Link>
      }
    >
      {visible.length === 0 ? (
        <p className="text-sm text-text-2">
          {doneIds.length ? "Tudo em dia por hoje." : "Nenhum follow-up pra hoje. Bom momento pra abordar gente nova."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {visible.slice(0, 6).map((f) => {
            const l = f.lead;
            const wa = whatsappLink(l.phone);
            return (
              <li key={l.id} className="py-2.5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      f.kind === "overdue" ? "bg-ember shadow-[0_0_8px_rgba(255,138,42,0.6)]" : f.kind === "today" ? "bg-ion" : "bg-text-2",
                    )}
                  />
                  <Link href={`/pipeline?lead=${l.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-0">
                      {l.name}
                      {l.business && <span className="text-text-2"> · {l.business}</span>}
                    </span>
                    <span className={cn("block text-xs", f.kind === "overdue" ? "text-ember" : "text-text-1")}>
                      {f.kind === "stale"
                        ? `Proposta parada há ${daysSince(l.stage_changed_at, now)} dias: cobrar retorno`
                        : `${l.next_action ?? "Fazer follow-up"}${
                            f.kind === "overdue" && l.next_action_on ? ` · atrasado desde ${l.next_action_on.slice(8, 10)}/${l.next_action_on.slice(5, 7)}` : ""
                          }`}
                    </span>
                  </Link>
                  <span className="-mr-1 flex shrink-0 items-center">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`WhatsApp de ${l.name}`}
                        className="flex size-9 items-center justify-center rounded-sm text-text-2 hover:text-text-0"
                      >
                        <MessageCircle size={16} strokeWidth={1.5} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(open === l.id ? null : l.id)}
                      aria-label={`Feito: ${l.name}`}
                      className="flex h-8 items-center gap-1 rounded-full border border-ion/40 px-2.5 text-xs text-ion transition-transform duration-150 active:scale-95"
                    >
                      <Check size={13} strokeWidth={2} /> Feito
                    </button>
                  </span>
                </div>
                {open === l.id && (
                  <NextStepForm
                    leadId={l.id}
                    today={today}
                    onDone={() => {
                      setOpen(null);
                      setDoneIds((d) => [...d, l.id]);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > 6 && <p className="mt-1 text-xs text-text-2">+ {visible.length - 6} no Pipeline</p>}
    </HudCard>
  );
}

function NextStepForm({ leadId, today, onDone }: { leadId: string; today: string; onDone: () => void }) {
  const [action, setAction] = useState("");
  const [date, setDate] = useState(nextBusinessDay(today));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await completeFollowup(leadId, action, date);
      if (r.ok) onDone();
      else setError(r.error);
    });
  }
  return (
    <form onSubmit={submit} className="mt-2 ml-5 flex flex-col gap-2">
      <input
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="Próximo passo (ex.: ligar pra fechar)"
        aria-label="Próximo passo"
        maxLength={200}
        autoFocus
        className="h-10 w-full rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-ion/60 focus:outline-none"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Data do próximo passo"
          className="num h-10 min-w-0 flex-1 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 focus:border-ion/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !action.trim()}
          aria-label="Salvar próximo passo"
          className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-ion text-bg-0 transition-transform duration-150 active:scale-95 disabled:opacity-40"
        >
          <ArrowRight size={18} strokeWidth={2} />
        </button>
      </div>
      {error && <p className="text-sm text-flare">{error}</p>}
    </form>
  );
}
