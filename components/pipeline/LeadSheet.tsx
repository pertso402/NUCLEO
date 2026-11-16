"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { ArrowRight, Check, MessageCircle, StickyNote, Trash2, X } from "lucide-react";
import { Money } from "@/components/hud/Money";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Lead, LeadEvent } from "@/lib/data/pipeline";
import {
  isLive,
  isOverdue,
  LOST_REASONS,
  nextBusinessDay,
  ORIGINS,
  STAGE_LABEL,
  STAGES,
  whatsappLink,
  type LeadOrigin,
  type LeadStage,
} from "@/lib/metrics/pipeline";
import { centsToInput } from "@/lib/money";
import {
  addLeadNote,
  completeFollowup,
  createLead,
  deleteLead,
  loadLeadEvents,
  loadLeadRevenue,
  setContractStatus,
  updateLeadFields,
  type ActionResult,
} from "@/app/(app)/pipeline/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-ion/60 focus:outline-none";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const LOST = Object.fromEntries(LOST_REASONS.map((r) => [r.value, r.label]));

/** Detalhe do lead (ou cadastro de um novo): etapa, próximo passo, dados, histórico e notas. */
export function LeadSheet({
  lead,
  today,
  onClose,
  onMove,
}: {
  /** null = novo lead. */
  lead: Lead | null;
  today: string;
  onClose: () => void;
  onMove: (stage: LeadStage, lostReason?: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={lead ? lead.name : "Novo lead"} className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-bg-0/70" />
      <aside className="pt-safe relative flex h-full w-full flex-col overflow-y-auto border-l border-line-strong bg-bg-1 sm:max-w-md">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-line bg-bg-1/95 px-4 py-3">
          <div className="min-w-0">
            <p className="label-instrument text-ion">{lead ? STAGE_LABEL[lead.stage] : "Pipeline"}</p>
            <h2 className="truncate font-display text-lg font-semibold text-text-0">{lead ? lead.name : "Novo lead"}</h2>
            {lead?.business && <p className="truncate text-sm text-text-2">{lead.business}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-2 hover:text-text-0"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </header>
        <div className="flex flex-col gap-5 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
          {lead ? (
            <ExistingLead lead={lead} today={today} onMove={onMove} onDeleted={onClose} />
          ) : (
            <LeadForm today={today} onDone={onClose} />
          )}
        </div>
      </aside>
    </div>
  );
}

function ExistingLead({
  lead,
  today,
  onMove,
  onDeleted,
}: {
  lead: Lead;
  today: string;
  onMove: (stage: LeadStage, lostReason?: string) => void;
  onDeleted: () => void;
}) {
  const [pickLost, setPickLost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wa = whatsappLink(lead.phone);

  const run = (fn: () => Promise<ActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) after?.();
      else setError(r.error);
    });
  };

  return (
    <>
      <section aria-label="Etapa">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={lead.stage === s.value}
              onClick={() => (s.value === "perdido" ? setPickLost(true) : onMove(s.value))}
              className={cn(
                "flex h-8 items-center rounded-full border px-3 text-xs transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                lead.stage === s.value
                  ? s.value === "fechado"
                    ? "border-volt/60 bg-volt/10 text-volt"
                    : s.value === "perdido"
                      ? "border-flare/50 bg-flare/10 text-flare"
                      : "border-ion/60 bg-ion/10 text-ion"
                  : "border-line text-text-2 hover:text-text-1",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {pickLost && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-flare/30 p-3">
            <p className="col-span-2 text-sm text-text-1">Por que não fechou?</p>
            {LOST_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setPickLost(false);
                  onMove("perdido", r.value);
                }}
                className="h-10 rounded-sm border border-line text-sm text-text-1 hover:border-flare/50 hover:text-text-0 active:scale-95"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {lead.stage === "perdido" && lead.lost_reason && (
          <p className="mt-2 text-xs text-text-2">Motivo: {LOST[lead.lost_reason]}</p>
        )}
        {lead.stage === "fechado" && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-text-2">Contrato</span>
            {(["ativo", "encerrado"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                aria-pressed={lead.contract_status === s}
                onClick={() => run(() => setContractStatus(lead.id, s))}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs active:scale-95",
                  lead.contract_status === s ? "border-volt/60 bg-volt/10 text-volt" : "border-line text-text-2",
                )}
              >
                {s === "ativo" ? "Ativo" : "Encerrado"}
              </button>
            ))}
          </div>
        )}
      </section>

      {isLive(lead.stage) && lead.next_action && <NextStep lead={lead} today={today} run={run} pending={pending} />}

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-sm border border-line text-sm text-text-1 transition-colors hover:border-line-strong hover:text-text-0"
        >
          <MessageCircle size={16} strokeWidth={1.5} /> Abrir conversa no WhatsApp
        </a>
      )}

      <details className="rounded-md border border-line px-3 py-2">
        <summary className="label-instrument cursor-pointer list-none py-1 select-none">Dados do lead</summary>
        <div className="mt-3">
          <LeadForm today={today} lead={lead} onDone={() => undefined} />
        </div>
      </details>

      <LeadRevenue leadId={lead.id} />

      <History leadId={lead.id} />

      <button
        type="button"
        disabled={pending}
        onClick={() => (confirmDelete ? run(() => deleteLead(lead.id), onDeleted) : setConfirmDelete(true))}
        className="flex h-10 items-center justify-center gap-1.5 self-start rounded-full px-3 text-xs text-text-2 transition-colors hover:text-flare"
      >
        <Trash2 size={14} strokeWidth={1.5} />
        {confirmDelete ? "Confirmar: excluir lead e histórico" : "Excluir lead"}
      </button>
    </>
  );
}

function NextStep({
  lead,
  today,
  run,
  pending,
}: {
  lead: Lead;
  today: string;
  run: (fn: () => Promise<ActionResult>, after?: () => void) => void;
  pending: boolean;
}) {
  const [doing, setDoing] = useState(false);
  const [action, setAction] = useState("");
  const [date, setDate] = useState(nextBusinessDay(today));
  const late = isOverdue(lead, today);
  return (
    <section className={cn("rounded-md border p-3", late ? "border-ember/50" : "border-line")} aria-label="Próximo passo">
      <p className="label-instrument mb-1">Próximo passo</p>
      <p className="text-sm text-text-0">{lead.next_action}</p>
      {lead.next_action_on && (
        <p className={cn("num text-xs", late ? "text-ember" : "text-text-2")}>
          {late ? "atrasado · " : ""}
          {lead.next_action_on.slice(8, 10)}/{lead.next_action_on.slice(5, 7)}
        </p>
      )}
      {!doing ? (
        <button
          type="button"
          onClick={() => setDoing(true)}
          className="mt-2 flex h-9 items-center gap-1.5 rounded-full border border-ion/40 px-3 text-xs text-ion active:scale-95"
        >
          <Check size={14} strokeWidth={2} /> Feito, agendar o próximo
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => completeFollowup(lead.id, action, date), () => setDoing(false));
          }}
          className="mt-2 flex flex-col gap-2"
        >
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="E agora? (ex.: ligar pra fechar)" className={field} autoFocus />
          <div className="flex gap-2">
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={cn(field, "num")} />
            <Button type="submit" disabled={pending || !action.trim()} className="shrink-0">
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function LeadForm({ today, lead, onDone }: { today: string; lead?: Lead; onDone: () => void }) {
  const [name, setName] = useState(lead?.name ?? "");
  const [business, setBusiness] = useState(lead?.business ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [segment, setSegment] = useState(lead?.segment ?? "");
  const [origin, setOrigin] = useState<LeadOrigin>(lead?.origin ?? "abordagem_fria");
  const [stage, setStage] = useState<LeadStage>(lead?.stage ?? "abordado");
  const [monthly, setMonthly] = useState(lead?.monthly_value_cents ? centsToInput(lead.monthly_value_cents) : "");
  const [setup, setSetup] = useState(lead?.setup_value_cents ? centsToInput(lead.setup_value_cents) : "");
  const [nextAction, setNextAction] = useState(lead?.next_action ?? "");
  const [nextOn, setNextOn] = useState(lead?.next_action_on ?? nextBusinessDay(today));
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const live = isLive(lead?.stage ?? stage);

  function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    const input = {
      name,
      business,
      phone,
      segment,
      origin,
      monthly_value: monthly,
      setup_value: setup,
      next_action: nextAction,
      next_action_on: live ? nextOn || null : null,
      notes,
    };
    start(async () => {
      const r = lead ? await updateLeadFields(lead.id, lead.stage, input) : await createLead({ ...input, stage });
      if (r.ok) {
        setStatus({ ok: true, text: "Salvo." });
        onDone();
      } else setStatus({ ok: false, text: r.error });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome" maxLength={120} className={field} autoFocus={!lead} />
      <input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Empresa" aria-label="Empresa" maxLength={120} className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" aria-label="Telefone" inputMode="tel" className={field} />
        <input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Segmento" aria-label="Segmento" maxLength={60} className={field} />
      </div>
      <select value={origin} onChange={(e) => setOrigin(e.target.value as LeadOrigin)} aria-label="Origem" className={field}>
        {ORIGINS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {!lead && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Etapa">
          {STAGES.filter((s) => isLive(s.value)).map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={stage === s.value}
              onClick={() => setStage(s.value)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs active:scale-95",
                stage === s.value ? "border-ion/60 bg-ion/10 text-ion" : "border-line text-text-2",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Mensalidade (R$)" aria-label="Mensalidade" inputMode="decimal" className={cn(field, "num")} />
        <input value={setup} onChange={(e) => setSetup(e.target.value)} placeholder="Implantação (R$)" aria-label="Implantação" inputMode="decimal" className={cn(field, "num")} />
      </div>
      {live && (
        <div className="grid grid-cols-[1fr_9.5rem] gap-2">
          <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Próxima ação" aria-label="Próxima ação" maxLength={200} className={field} />
          <input type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} aria-label="Data da próxima ação" className={cn(field, "num")} />
        </div>
      )}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Observações"
        aria-label="Observações"
        rows={2}
        maxLength={2000}
        className={cn(field, "h-auto py-2.5")}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !name.trim()}>
          {lead ? "Salvar dados" : "Criar lead"}
        </Button>
        {status && <p className={cn("text-sm", status.ok ? "text-volt" : "text-flare")}>{status.text}</p>}
      </div>
    </form>
  );
}

/** Quanto já entrou desse cliente (receitas vinculadas ao lead — 3.8). */
function LeadRevenue({ leadId }: { leadId: string }) {
  const [rev, setRev] = useState<{ totalCents: number; count: number } | null>(null);
  useEffect(() => {
    let alive = true;
    loadLeadRevenue(leadId).then((r) => alive && setRev(r));
    return () => {
      alive = false;
    };
  }, [leadId]);
  if (!rev || rev.count === 0) return null;
  return (
    <p className="text-sm text-text-1">
      Receita recebida: <Money cents={rev.totalCents} showCents={false} tone="volt" /> em {rev.count}{" "}
      {rev.count === 1 ? "lançamento" : "lançamentos"}
    </p>
  );
}

function History({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<LeadEvent[] | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    loadLeadEvents(leadId).then((ev) => alive && setEvents(ev));
    return () => {
      alive = false;
    };
  }, [leadId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    start(async () => {
      const r = await addLeadNote(leadId, note);
      if (r.ok) {
        setNote("");
        setEvents(await loadLeadEvents(leadId));
      }
    });
  }

  const describe = (ev: LeadEvent): string => {
    if (ev.type === "stage_change") {
      const to = STAGE_LABEL[ev.to_stage as LeadStage] ?? ev.to_stage;
      if (!ev.from_stage) return `Entrou em ${to}`;
      const reason = ev.payload?.lost_reason ? ` (${LOST[String(ev.payload.lost_reason)] ?? ev.payload.lost_reason})` : "";
      return `${STAGE_LABEL[ev.from_stage as LeadStage] ?? ev.from_stage} → ${to}${reason}`;
    }
    if (ev.type === "followup_done") return `Follow-up feito${ev.payload?.action ? `: ${String(ev.payload.action)}` : ""}`;
    return String(ev.payload?.text ?? "Nota");
  };

  return (
    <section aria-label="Histórico">
      <p className="label-instrument mb-2">Histórico</p>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anotar algo…" aria-label="Nova nota" maxLength={1000} className={field} />
        <Button type="submit" variant="secondary" disabled={pending || !note.trim()} aria-label="Salvar nota" className="w-11 shrink-0 px-0">
          <StickyNote size={16} strokeWidth={1.5} />
        </Button>
      </form>
      {events === null ? (
        <p className="text-sm text-text-2">Carregando…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-text-2">Sem histórico ainda.</p>
      ) : (
        <ol className="relative flex flex-col gap-3 pl-4">
          <span aria-hidden className="absolute top-1 bottom-1 left-[3px] w-px bg-line-strong" />
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 -left-4 size-[7px] rounded-full",
                  ev.type === "note" ? "bg-text-2" : ev.to_stage === "fechado" ? "bg-volt shadow-glow-volt" : ev.to_stage === "perdido" ? "bg-flare" : "bg-ion",
                )}
              />
              <p className="text-sm text-text-1">{describe(ev)}</p>
              <p className="num text-[11px] text-text-2">{dateTime.format(new Date(ev.created_at))}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
