"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Flame, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useFocusMaybe } from "@/components/focus/FocusProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { addDays, diffDays, formatMonthLong, formatMonthShort, todayISO, weekday, type ISODate } from "@/lib/dates";
import type { Project } from "@/lib/data/productivity";
import {
  compare,
  daysIn,
  entryDay,
  entryMinutes,
  fmtHours,
  focusStreak,
  hourHeatmap,
  monthlySeries,
  periodRange,
  previousRange,
  shiftRange,
  summarize,
  weeklySeries,
  type Granularity,
  type Range,
  type TimeEntryRow,
} from "@/lib/metrics/time";
import { projectHex } from "@/lib/projects-palette";
import { deleteTimeEntry } from "@/app/(app)/rotina/actions";
import { logTime } from "@/app/(app)/rotina/productivity-actions";
import { EvolutionChart, HourHeatmap, HoursOfDayChart, ProjectDonut, StackedDaysChart, type Series } from "./TimeCharts";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-plasma/60 focus:outline-none";

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dm = (iso: ISODate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function rangeLabel(g: Granularity, r: Range, today: ISODate): string {
  if (g === "day") {
    if (r.start === today) return "Hoje";
    if (r.start === addDays(today, -1)) return "Ontem";
    return `${WD[weekday(r.start)]}, ${dm(r.start)}`;
  }
  if (g === "week") return r.start <= today && today <= r.end ? `Esta semana · ${dm(r.start)}–${dm(r.end)}` : `${dm(r.start)} – ${dm(r.end)}`;
  const m = formatMonthLong(r.start);
  return m.charAt(0).toUpperCase() + m.slice(1);
}

const PREV_LABEL: Record<Granularity, string> = { day: "o dia anterior", week: "a semana anterior", month: "o mês anterior" };

/**
 * Período anterior comparável: se o período atual ainda está em andamento, compara com o mesmo
 * trecho do anterior (seg–qui × seg–qui), senão a semana cheia de hoje perde sempre.
 */
function comparableRange(g: Granularity, cur: Range, today: ISODate): { range: Range; partial: boolean } {
  const prev = previousRange(g, cur);
  if (g === "day" || !(cur.start <= today && today < cur.end)) return { range: prev, partial: false };
  const elapsed = diffDays(cur.start, today);
  const end = addDays(prev.start, elapsed);
  return { range: { start: prev.start, end: end < prev.end ? end : prev.end }, partial: true };
}

export function TimeAnalytics({
  entries,
  projects,
  today,
  serverNow,
  focusGoalMinutes,
}: {
  entries: TimeEntryRow[];
  projects: Project[];
  today: ISODate;
  serverNow: string;
  focusGoalMinutes: number;
}) {
  const focus = useFocusMaybe();
  const nowDate = useMemo(() => new Date(focus?.now ?? Date.parse(serverNow)), [focus?.now, serverNow]);
  const [g, setG] = useState<Granularity>("week");
  const [ref, setRef] = useState<ISODate>(today);
  const [evo, setEvo] = useState<"weeks" | "months">("weeks");
  const [showLog, setShowLog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const range = periodRange(g, ref);
  const isCurrent = range.start <= today && today <= range.end;
  const cmp = comparableRange(g, range, today);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const nameOf = (id: string | null) => (id ? (projectById.get(id)?.name ?? "Projeto arquivado") : "Sem projeto");
  const colorOf = (id: string | null) => projectHex(id ? projectById.get(id)?.color : null);

  const cur = useMemo(() => summarize(entries, range, nowDate), [entries, range.start, range.end, nowDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => summarize(entries, cmp.range, nowDate), [entries, cmp.range.start, cmp.range.end, nowDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const streak = useMemo(() => focusStreak(entries, today, nowDate, 30), [entries, today, nowDate]);

  const total = compare(cur.totalMinutes, prev.totalMinutes);
  const avg = compare(cur.avgPerActiveDay, prev.avgPerActiveDay);
  const pomos = compare(cur.pomodoros, prev.pomodoros);

  // séries do gráfico por dia (empilhado por projeto)
  const seriesKeys = cur.byProject.map((p) => p.projectId ?? "none");
  const series: Series[] = seriesKeys.map((k) => ({ key: k, name: nameOf(k === "none" ? null : k), color: colorOf(k === "none" ? null : k) }));
  const dayRows = cur.byDay.map((d) => ({ date: d.date, ...Object.fromEntries(seriesKeys.map((k) => [k, d.byProject[k] ?? 0])) }));

  const heatRange = g === "day" ? periodRange("week", ref) : range;
  const heat = useMemo(() => hourHeatmap(entries, heatRange, nowDate), [entries, heatRange.start, heatRange.end, nowDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayHours = g === "day" ? hourHeatmap(entries, range, nowDate)[(weekday(range.start) + 6) % 7]! : null;

  const evolution = useMemo(() => {
    if (evo === "weeks")
      return weeklySeries(entries, today, nowDate, 12).map((w, i, a) => ({ key: w.weekStart, minutes: w.minutes, current: i === a.length - 1 }));
    return monthlySeries(entries, today, nowDate, 6).map((m, i, a) => ({ key: m.month, minutes: m.minutes, current: i === a.length - 1 }));
  }, [entries, evo, today, nowDate]);

  // atividades do período (tarefa ou rótulo)
  const inRange = useMemo(
    () => entries.filter((e) => e.is_focus && entryDay(e) >= range.start && entryDay(e) <= range.end),
    [entries, range.start, range.end],
  );
  const activities = useMemo(() => {
    const m = new Map<string, { label: string; projectId: string | null; minutes: number; sessions: number }>();
    for (const e of inRange) {
      const key = e.task_id ?? `l:${(e.label ?? "").trim().toLowerCase()}|${e.project_id ?? ""}`;
      const a = m.get(key) ?? { label: e.label?.trim() || "Sem descrição", projectId: e.project_id, minutes: 0, sessions: 0 };
      a.minutes += entryMinutes(e, nowDate);
      a.sessions++;
      m.set(key, a);
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 6);
  }, [inRange, nowDate]);

  const prevByProject = new Map(prev.byProject.map((p) => [p.projectId, p.minutes]));
  const weeksInRange = daysIn(range).length / 7;

  const del = (id: string) => {
    setError(null);
    start(async () => {
      const r = await deleteTimeEntry(id);
      if (!r.ok) setError(r.error);
    });
  };

  const atLatest = range.end >= today;

  return (
    <div className="flex flex-col gap-5">
      {/* controles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Período" className="flex self-start rounded-full border border-line p-1">
          {(
            [
              ["day", "Dia"],
              ["week", "Semana"],
              ["month", "Mês"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={g === v}
              onClick={() => {
                setG(v);
                setRef(today);
              }}
              className={cn(
                "h-8 rounded-full px-4 text-sm transition-[background-color,color,transform] duration-150 active:scale-95",
                g === v ? "bg-plasma/20 text-text-0 shadow-[inset_0_0_0_1px_rgba(124,92,255,0.5)]" : "text-text-2 hover:text-text-1",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Período anterior"
            onClick={() => setRef(shiftRange(g, range, -1).start)}
            className="flex size-9 items-center justify-center rounded-full text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <span className="min-w-0 flex-1 text-center text-sm text-text-0 sm:min-w-44">{rangeLabel(g, range, today)}</span>
          <button
            type="button"
            aria-label="Próximo período"
            disabled={atLatest}
            onClick={() => setRef(shiftRange(g, range, 1).start)}
            className="flex size-9 items-center justify-center rounded-full text-text-1 transition-[color,transform] duration-150 hover:text-text-0 active:scale-90 disabled:opacity-30"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
          {!isCurrent && (
            <button type="button" onClick={() => setRef(today)} className="h-8 rounded-full border border-line px-3 text-xs text-text-1 hover:text-text-0">
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Foco total" value={fmtHours(cur.totalMinutes)} delta={total} fmt={fmtHours} accent />
        <Kpi label="Média por dia ativo" value={fmtHours(cur.avgPerActiveDay)} delta={avg} fmt={fmtHours} />
        <Kpi label="Pomodoros" value={String(cur.pomodoros)} delta={pomos} fmt={(n) => String(n)} />
        <div className="edge-light flex flex-col gap-1 rounded-md border border-line bg-bg-2/80 p-3">
          <span className="label-instrument">Dias ativos</span>
          <span className="num font-display text-2xl text-text-0">
            {cur.activeDays}
            <span className="text-sm text-text-2">/{daysIn(range).filter((d) => d <= today).length || 1}</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-text-1">
            <Flame size={12} strokeWidth={1.75} className={streak > 0 ? "text-ember" : "text-text-2"} aria-hidden />
            {streak > 0 ? `${streak} ${streak === 1 ? "dia" : "dias"} seguidos (≥30min)` : "sem sequência"}
          </span>
        </div>
      </section>
      <p className="-mt-3 text-xs text-text-2">
        Comparado com {PREV_LABEL[g]}
        {cmp.partial ? ` até o mesmo dia (${dm(cmp.range.start)}–${dm(cmp.range.end)})` : ""}
        {cur.bestDay && g !== "day" ? ` · melhor dia: ${WD[weekday(cur.bestDay.date)]} ${dm(cur.bestDay.date)} com ${fmtHours(cur.bestDay.minutes)}` : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* gráfico principal */}
        <section className="edge-light rounded-md border border-line bg-bg-2/80 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="label-instrument">{g === "day" ? "Horas ao longo do dia" : "Horas por dia"}</h3>
            {g !== "day" && <span className="text-xs text-text-2">tracejado = meta diária {fmtHours(focusGoalMinutes)}</span>}
          </div>
          {g === "day" ? (
            <HoursOfDayChart hours={dayHours!} />
          ) : (
            <StackedDaysChart
              data={dayRows}
              series={series}
              goalMinutes={focusGoalMinutes}
              highlight={today}
              xLabel={(d) => (g === "week" ? WD[weekday(d)]! : d.slice(8, 10))}
              tooltipLabel={(d) => `${WD[weekday(d)]}, ${dm(d)}`}
            />
          )}
        </section>

        {/* por projeto */}
        <section className="edge-light flex flex-col gap-4 rounded-md border border-line bg-bg-2/80 p-4">
          <h3 className="label-instrument">Por projeto</h3>
          <ProjectDonut
            total={cur.totalMinutes}
            slices={cur.byProject.map((p) => ({ name: nameOf(p.projectId), minutes: p.minutes, color: colorOf(p.projectId) }))}
          />
          {cur.byProject.length === 0 ? (
            <p className="text-center text-sm text-text-2">Nenhum foco nesse período.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {cur.byProject.map((p) => {
                const pr = p.projectId ? projectById.get(p.projectId) : null;
                const goal = pr?.weekly_hours_goal && g !== "day" ? pr.weekly_hours_goal * 60 * weeksInRange : null;
                const before = prevByProject.get(p.projectId) ?? 0;
                const d = compare(p.minutes, before);
                return (
                  <li key={p.projectId ?? "none"} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: colorOf(p.projectId) }} />
                      <span className="min-w-0 flex-1 truncate text-text-0">{nameOf(p.projectId)}</span>
                      <span className="num text-text-0">{fmtHours(p.minutes)}</span>
                      <span className="num w-9 text-right text-xs text-text-2">{Math.round((p.minutes / Math.max(1, cur.totalMinutes)) * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2 pl-4 text-xs text-text-2">
                      {goal ? (
                        <>
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                            <span
                              className="block h-full origin-left rounded-full"
                              style={{ background: colorOf(p.projectId), transform: `scaleX(${Math.min(1, p.minutes / goal)})` }}
                            />
                          </span>
                          <span className="num">meta {fmtHours(goal)}</span>
                        </>
                      ) : (
                        <span className="flex-1" />
                      )}
                      <DeltaText delta={d} fmt={fmtHours} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* evolução */}
        <section className="edge-light rounded-md border border-line bg-bg-2/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="label-instrument">Evolução</h3>
            <div className="flex rounded-full border border-line p-0.5">
              {(
                [
                  ["weeks", "12 semanas"],
                  ["months", "6 meses"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={evo === v}
                  onClick={() => setEvo(v)}
                  className={cn("h-7 rounded-full px-3 text-xs", evo === v ? "bg-white/[0.08] text-text-0" : "text-text-2 hover:text-text-1")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <EvolutionChart
            data={evolution}
            xLabel={(k) => (evo === "weeks" ? dm(k) : formatMonthShort(k))}
            tooltipLabel={(k) => (evo === "weeks" ? `Semana de ${dm(k)}` : formatMonthLong(k))}
          />
          <p className="mt-2 text-xs text-text-2">tracejado = média dos períodos anteriores</p>
        </section>

        {/* mapa de horários */}
        <section className="edge-light rounded-md border border-line bg-bg-2/80 p-4">
          <h3 className="label-instrument mb-3">Quando você foca {g === "day" ? "(nesta semana)" : ""}</h3>
          <HourHeatmap grid={heat} />
          <HeatInsight grid={heat} />
        </section>
      </div>

      {/* atividades */}
      {activities.length > 0 && (
        <section>
          <h3 className="label-instrument mb-2">No que o tempo foi</h3>
          <ul className="flex flex-col gap-1.5">
            {activities.map((a, i) => (
              <li key={i} className="relative flex items-center gap-3 overflow-hidden rounded-md border border-line bg-bg-2/80 px-3 py-2">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 origin-left opacity-[0.08]"
                  style={{ width: "100%", background: colorOf(a.projectId), transform: `scaleX(${a.minutes / Math.max(1, activities[0]!.minutes)})` }}
                />
                <span aria-hidden className="relative size-2 shrink-0 rounded-full" style={{ background: colorOf(a.projectId) }} />
                <span className="relative flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-text-0">{a.label}</span>
                  <span className="truncate text-xs text-text-2">
                    {nameOf(a.projectId)} · {a.sessions} {a.sessions === 1 ? "sessão" : "sessões"}
                  </span>
                </span>
                <span className="num relative shrink-0 text-sm text-text-0">{fmtHours(a.minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* registros */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="label-instrument">Registros do período · {inRange.length}</h3>
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            className="flex h-8 items-center gap-1 rounded-full border border-plasma/40 px-3 text-xs text-plasma transition-transform duration-150 active:scale-95"
          >
            <Plus size={14} strokeWidth={2} /> Lançar tempo
          </button>
        </div>
        {showLog && <LogForm today={today} projects={projects} onDone={() => setShowLog(false)} />}
        {error && (
          <p role="alert" className="mb-2 text-sm text-flare">
            {error}
          </p>
        )}
        {inRange.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-sm text-text-2">Nada registrado nesse período.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {inRange.slice(0, 25).map((e) => {
              const day = todayISO(new Date(e.started_at));
              return (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: colorOf(e.project_id) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-1">{e.label || nameOf(e.project_id)}</span>
                    <span className="num text-xs text-text-2">
                      {day === today ? "hoje" : `${WD[weekday(day)]} ${dm(day)}`} · {timeFmt.format(new Date(e.started_at))}
                      {e.ended_at ? `–${timeFmt.format(new Date(e.ended_at))}` : " · rodando"}
                      {e.kind === "pomodoro" ? " · pomodoro" : e.kind === "manual" ? " · manual" : ""}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm text-text-0">{fmtHours(entryMinutes(e, nowDate))}</span>
                  {e.ended_at && <DeleteEntry onDelete={() => del(e.id)} disabled={pending} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DeltaText({ delta, fmt }: { delta: ReturnType<typeof compare>; fmt: (n: number) => string }) {
  if (delta.trend === "same") return <span className="num text-text-2">=</span>;
  const up = delta.trend === "up";
  return (
    <span className={cn("num flex items-center gap-0.5", up ? "text-volt" : "text-ember")}>
      {up ? <TrendingUp size={11} strokeWidth={2} aria-hidden /> : <TrendingDown size={11} strokeWidth={2} aria-hidden />}
      {up ? "+" : "−"}
      {fmt(Math.abs(delta.diff))}
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  fmt,
  accent,
}: {
  label: string;
  value: string;
  delta: ReturnType<typeof compare>;
  fmt: (n: number) => string;
  accent?: boolean;
}) {
  return (
    <div className={cn("edge-light relative flex flex-col gap-1 overflow-hidden rounded-md border bg-bg-2/80 p-3", accent ? "border-plasma/40" : "border-line")}>
      {accent && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-plasma shadow-glow-plasma" />}
      <span className="label-instrument">{label}</span>
      <span className={cn("num font-display text-2xl", accent ? "text-text-0 neon-white" : "text-text-0")}>{value}</span>
      <span className="flex items-center gap-1.5 text-xs">
        <DeltaText delta={delta} fmt={fmt} />
        {delta.pct !== null && delta.trend !== "same" && <span className="num text-text-2">({Math.round(delta.pct * 100)}%)</span>}
      </span>
    </div>
  );
}

const WD_MON = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
function HeatInsight({ grid }: { grid: number[][] }) {
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + (row[h] ?? 0), 0));
  const byDay = grid.map((row) => row.reduce((a, b) => a + b, 0));
  const total = byDay.reduce((a, b) => a + b, 0);
  if (!total) return <p className="mt-2 text-xs text-text-2">Sem foco registrado para montar o mapa.</p>;
  // melhor janela de 2h
  let best = 0;
  for (let h = 1; h < 23; h++) if (byHour[h]! + byHour[h + 1]! > byHour[best]! + byHour[best + 1]!) best = h;
  const day = byDay.indexOf(Math.max(...byDay));
  return (
    <p className="mt-2 text-xs text-text-1">
      Seu pico é entre <span className="num text-text-0">{best}h e {best + 2}h</span>; o dia mais forte é <span className="text-text-0">{WD_MON[day]}</span>.
    </p>
  );
}

function DeleteEntry({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={confirm ? "Confirmar exclusão" : "Excluir registro"}
      onClick={() => (confirm ? onDelete() : setConfirm(true))}
      onBlur={() => setConfirm(false)}
      className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-text-2 transition-[color,transform] duration-150 hover:text-flare active:scale-90"
    >
      <Trash2 size={14} strokeWidth={1.5} />
      {confirm && "Excluir"}
    </button>
  );
}

function LogForm({ today, projects, onDone }: { today: ISODate; projects: Project[]; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [project, setProject] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = Number(minutes);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await logTime({ label, minutes: n, date, project_id: project || null });
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="glass edge-light mb-3 flex flex-col gap-2.5 rounded-md border border-plasma/30 p-3">
      <div className="flex gap-2">
        <select aria-label="Projeto" value={project} onChange={(e) => setProject(e.target.value)} className={cn(field, "max-w-[45%] appearance-none")}>
          <option value="">Sem projeto</option>
          {projects
            .filter((p) => p.status === "active")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="No que trabalhou" aria-label="Descrição" maxLength={120} className={field} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Minutos</span>
          <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="90" className={cn(field, "num")} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Dia</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={cn(field, "num")} />
        </label>
      </div>
      {error && <p className="text-sm text-flare">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !(n >= 1 && n <= 1440)} variant="focus">
          Lançar
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
