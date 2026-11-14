"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check } from "lucide-react";
import { ScoreRing } from "@/components/command/ScoreRing";
import { HudCard } from "@/components/hud/HudCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { DailyReview as Saved } from "@/lib/data/review";
import type { TodayData } from "@/lib/data/today";
import { saveDailyReview } from "@/app/(app)/revisao/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

const ENERGY = ["Esgotado", "Baixa", "Ok", "Boa", "No talo"];
const WD = ["D", "S", "T", "Q", "Q", "S", "S"];

function fmtMin(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

/** Fechamento do dia em 60 segundos (ARCHITECTURE §7.7): placar + vitória, aprendizado, energia e top 3 de amanhã. */
export function DailyReview({
  day,
  saved,
  yesterdayTop3,
  last7,
}: {
  day: TodayData;
  saved: Saved | null;
  yesterdayTop3: string[];
  last7: { date: string; score: number | null }[];
}) {
  const [win, setWin] = useState(saved?.win ?? "");
  const [lesson, setLesson] = useState(saved?.lesson ?? "");
  const [energy, setEnergy] = useState<number | null>(saved?.energy ?? null);
  const [top, setTop] = useState<string[]>(() => [0, 1, 2].map((i) => saved?.tomorrow_top3[i] ?? ""));
  const [createTasks, setCreateTasks] = useState(true);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    start(async () => {
      const r = await saveDailyReview({ win, lesson, energy, top3: top, createTasks });
      if (r.ok) {
        const n = r.created ?? 0;
        setStatus({ ok: true, text: n ? `Salvo. ${n} ${n === 1 ? "tarefa criada" : "tarefas criadas"} pra amanhã.` : "Salvo." });
      } else setStatus({ ok: false, text: r.error });
    });
  }

  const comps = day.score.components;
  const val = (k: string) => comps.find((c) => c.key === k)?.value ?? null;
  const rows = [
    {
      label: "Faturamento",
      value: `${day.revenueDoneToday}${day.revenuePlanned ? `/${Math.min(day.revenuePlanned, 3)}` : ""}`,
      v: val("revenue_tasks"),
    },
    { label: "Foco", value: day.workday ? `${fmtMin(day.focusMinutes)} de ${fmtMin(day.focusGoalMinutes)}` : "folga", v: val("focus") },
    { label: "Hábitos", value: day.habitsExpected ? `${day.habitsDone}/${day.habitsExpected}` : "—", v: val("habits") },
    { label: "Abordagens", value: "— (Pipeline)", v: null },
  ];
  const maxScore = Math.max(...last7.map((d) => d.score ?? 0), 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-5">
        <HudCard label="Placar de hoje" accent="volt">
          <div className="flex items-center gap-5">
            <ScoreRing score={day.score.score} size={88} />
            <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
              {rows.map((r) => (
                <li key={r.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-text-2">{r.label}</span>
                  <span className={cn("num truncate", r.v === null ? "text-text-2" : r.v >= 1 ? "neon-volt" : "text-text-0")}>{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex h-12 items-end gap-1.5" role="img" aria-label="Score dos últimos 7 dias">
            {last7.map((d, i) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={cn("w-full origin-bottom rounded-t-[3px]", i === 6 ? "bg-volt shadow-glow-volt" : "bg-volt/35")}
                  style={{ height: "100%", transform: `scaleY(${(i === 6 ? day.score.score : (d.score ?? 0)) / maxScore || 0.02})` }}
                />
                <span className="num text-[9px] text-text-2">{WD[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}</span>
              </div>
            ))}
          </div>
        </HudCard>

        {yesterdayTop3.length > 0 && (
          <HudCard label="Seu top 3 de ontem pra hoje">
            <ol className="flex flex-col gap-1.5 text-sm text-text-1">
              {yesterdayTop3.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num text-text-2">{i + 1}.</span>
                  {t}
                </li>
              ))}
            </ol>
          </HudCard>
        )}
      </div>

      <form onSubmit={submit} className="glass edge-light flex flex-col gap-4 rounded-md border border-line p-4 lg:col-span-7">
        <h2 className="label-instrument">Fechamento em 60 segundos</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-1">Vitória do dia</span>
          <input value={win} onChange={(e) => setWin(e.target.value)} maxLength={500} placeholder="O que deu certo hoje?" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-1">O que aprendi</span>
          <input
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            maxLength={500}
            placeholder="O que faria diferente?"
            className={field}
          />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm text-text-1">Energia</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {ENERGY.map((label, i) => {
              const n = i + 1;
              const on = energy === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEnergy(on ? null : n)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-sm border transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                    on ? "border-volt/60 bg-volt/15 text-volt shadow-[0_0_10px_rgba(200,255,46,0.25)]" : "border-line text-text-2 hover:text-text-1",
                  )}
                >
                  <span className="num text-base">{n}</span>
                  <span className="text-[10px] leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm text-text-1">Top 3 de amanhã</legend>
          {top.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="num w-4 text-sm text-text-2">{i + 1}</span>
              <input
                value={t}
                onChange={(e) => setTop((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={200}
                placeholder={i === 0 ? "A mais importante (que traga dinheiro)" : ""}
                aria-label={`Prioridade ${i + 1} de amanhã`}
                className={field}
              />
            </div>
          ))}
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-text-1">
            <input type="checkbox" checked={createTasks} onChange={(e) => setCreateTasks(e.target.checked)} className="size-4 accent-[#C8FF2E]" />
            Criar como tarefas pra amanhã
          </label>
        </fieldset>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {saved ? "Atualizar fechamento" : "Fechar o dia"}
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
