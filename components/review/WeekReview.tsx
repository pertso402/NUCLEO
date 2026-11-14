"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import type { WeeklyReview } from "@/lib/data/review";
import { formatBRL } from "@/lib/money";
import { delta, weekLabel, type WeekNumbers } from "@/lib/metrics/week";
import { saveWeeklyReview } from "@/app/(app)/revisao/actions";

const area =
  "w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 py-2.5 text-base leading-snug text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

function fmtMin(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v}min`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}
const brl = (c: number) => formatBRL(c, { cents: false });

type Metric = {
  label: string;
  cur: number | null;
  prev: number | null;
  show: (n: number) => string;
  /** Formato da diferença (padrão: o mesmo de show). */
  showDelta?: (n: number) => string;
  /** true = subir é ruim (despesa). */
  inverse?: boolean;
  tone?: "volt" | "flare" | "plasma";
};

/** Revisão semanal (ARCHITECTURE §7.7): números da semana vs anterior + vitórias, erros e foco. */
export function WeekReview({
  weekStart,
  numbers,
  previous,
  review,
  current,
  base = "/revisao",
}: {
  weekStart: string;
  numbers: WeekNumbers;
  previous: WeekNumbers;
  review: WeeklyReview | null;
  /** Semana ainda em andamento. */
  current: boolean;
  base?: string;
}) {
  const [wins, setWins] = useState(review?.wins ?? "");
  const [misses, setMisses] = useState(review?.misses ?? "");
  const [focus, setFocus] = useState(review?.focus_next_week ?? "");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const href = (ws: string) => `${base}?aba=semana&semana=${ws}`;

  const metrics: Metric[] = [
    { label: "Receita", cur: numbers.incomeCents, prev: previous.incomeCents, show: brl, tone: "volt" },
    { label: "Despesa", cur: numbers.expenseCents, prev: previous.expenseCents, show: brl, inverse: true, tone: "flare" },
    { label: "Saldo", cur: numbers.netCents, prev: previous.netCents, show: brl },
    { label: "Foco", cur: numbers.focusMinutes, prev: previous.focusMinutes, show: fmtMin, tone: "plasma" },
    { label: "Tarefas de faturamento", cur: numbers.revenueTasksDone, prev: previous.revenueTasksDone, show: String },
    { label: "Tarefas feitas", cur: numbers.tasksDone, prev: previous.tasksDone, show: String },
    {
      label: "Hábitos",
      cur: numbers.habitsDone,
      prev: previous.habitsDone,
      show: (n) => (numbers.habitsTarget ? `${n}/${numbers.habitsTarget}` : String(n)),
      showDelta: String,
    },
    { label: "Score médio", cur: numbers.avgScore, prev: previous.avgScore, show: (n) => String(n) },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const r = await saveWeeklyReview({ weekStart, wins, misses, focus });
      setStatus(r.ok ? { ok: true, text: "Revisão salva." } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <HudCard accent="volt">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={href(addDays(weekStart, -7))}
            scroll={false}
            aria-label="Semana anterior"
            className="flex size-9 items-center justify-center rounded-full text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </Link>
          <div className="text-center">
            <p className="num font-display text-base font-semibold text-text-0">{weekLabel(weekStart)}</p>
            <p className="text-xs text-text-2">{current ? "semana em andamento" : "comparado com a semana anterior"}</p>
          </div>
          <Link
            href={href(addDays(weekStart, 7))}
            scroll={false}
            aria-label="Próxima semana"
            className="flex size-9 items-center justify-center rounded-full text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </Link>
        </div>
      </HudCard>

      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const d = delta(m.cur, m.prev);
          const good = d && d.trend !== "same" ? (d.trend === "up") !== Boolean(m.inverse) : null;
          return (
            <li key={m.label} className="glass edge-light flex min-w-0 flex-col gap-1 rounded-md border border-line p-3">
              <span className="label-instrument line-clamp-2">{m.label}</span>
              <span
                className={cn(
                  "num truncate text-lg",
                  m.cur === null ? "text-text-2" : m.tone === "volt" && m.cur > 0 ? "neon-volt" : m.tone === "plasma" && m.cur > 0 ? "text-plasma" : "text-text-0",
                )}
              >
                {m.cur === null ? "—" : m.show(m.cur)}
              </span>
              <span className={cn("num text-xs", good === null ? "text-text-2" : good ? "text-volt" : "text-flare")}>
                {d === null
                  ? "sem comparação"
                  : d.trend === "same"
                    ? "= semana anterior"
                    : `${d.trend === "up" ? "↑" : "↓"} ${(m.showDelta ?? m.show)(Math.abs(d.diff))}`}
              </span>
            </li>
          );
        })}
      </ul>

      <form onSubmit={submit} className="glass edge-light flex flex-col gap-4 rounded-md border border-line p-4">
        <h2 className="label-instrument">Revisão da semana</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-1">Vitórias</span>
          <textarea value={wins} onChange={(e) => setWins(e.target.value)} rows={3} maxLength={2000} placeholder="O que andou?" className={area} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-1">O que não deu certo</span>
          <textarea
            value={misses}
            onChange={(e) => setMisses(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Onde travou e por quê?"
            className={area}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-1">Foco da próxima semana</span>
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="A uma coisa que, se acontecer, faz a semana valer."
            className={area}
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {review ? "Atualizar revisão" : "Salvar revisão"}
          </Button>
          {status && (
            <p role="status" className={cn("flex items-center gap-1 text-sm", status.ok ? "text-volt" : "text-flare")}>
              {status.ok && <Check size={15} strokeWidth={2} />}
              {status.text}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
