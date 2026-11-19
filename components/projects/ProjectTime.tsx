"use client";

import { EvolutionChart } from "@/components/time/TimeCharts";
import { formatMonthLong, type ISODate } from "@/lib/dates";
import { fmtHours, weeklySeries, type TimeEntryRow } from "@/lib/metrics/time";

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Horas do projeto nas últimas 12 semanas + números-chave. */
export function ProjectTime({
  entries,
  today,
  serverNow,
  weeklyGoalHours,
  stats,
}: {
  entries: TimeEntryRow[];
  today: ISODate;
  serverNow: string;
  weeklyGoalHours: number | null;
  stats: { minutesWeek: number; minutesMonth: number; minutesTotal: number; openTasks: number; doneTasks: number };
}) {
  const now = new Date(serverNow);
  const series = weeklySeries(entries, today, now, 12).map((w, i, a) => ({ key: w.weekStart, minutes: w.minutes, current: i === a.length - 1 }));
  const goal = weeklyGoalHours ? weeklyGoalHours * 60 : null;
  const pct = goal ? Math.min(1, stats.minutesWeek / goal) : null;
  const total = stats.openTasks + stats.doneTasks;
  const hitWeeks = goal ? series.filter((w) => !w.current && w.minutes >= goal).length : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Números do projeto">
        <Tile label="Semana" value={fmtHours(stats.minutesWeek)} sub={goal ? `de ${fmtHours(goal)} (${Math.round((pct ?? 0) * 100)}%)` : "sem meta"} accent />
        <Tile label="Mês" value={fmtHours(stats.minutesMonth)} sub={formatMonthLong(today)} />
        <Tile label="Total" value={fmtHours(stats.minutesTotal)} sub={hitWeeks !== null ? `meta batida em ${hitWeeks} de 11 semanas` : "desde o início"} />
        <Tile
          label="Tarefas"
          value={`${stats.doneTasks}/${total}`}
          sub={total ? `${Math.round((stats.doneTasks / total) * 100)}% concluídas` : "nenhuma ainda"}
        />
      </section>
      <section className="edge-light rounded-md border border-line bg-bg-2/80 p-4">
        <h3 className="label-instrument mb-3">Horas por semana</h3>
        <EvolutionChart data={series} xLabel={dm} tooltipLabel={(k) => `Semana de ${dm(k)}`} />
      </section>
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`edge-light relative flex flex-col gap-1 overflow-hidden rounded-md border bg-bg-2/80 p-3 ${accent ? "border-plasma/40" : "border-line"}`}>
      <span className="label-instrument">{label}</span>
      <span className="num font-display text-2xl text-text-0">{value}</span>
      <span className="text-xs text-text-2">{sub}</span>
    </div>
  );
}
