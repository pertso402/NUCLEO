"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "@/components/money/chart-theme";
import { cn } from "@/lib/cn";
import { fmtHours } from "@/lib/metrics/time";

/** Tooltip do tempo (mesmo visual do ChartTooltip, valores em minutos → "3h20"). */
export function TimeTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: string | number; name?: string | number; value?: number | string | null; color?: string; payload?: unknown }[];
  label?: ReactNode;
  labelFormatter?: (label: ReactNode) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => typeof p.value === "number" && p.value > 0);
  if (!rows.length) return null;
  const total = rows.reduce((s, p) => s + (p.value as number), 0);
  return (
    <div className="rounded-sm border border-line-strong bg-bg-3 px-3 py-2 text-xs">
      {label !== undefined && <p className="mb-1 text-text-2">{labelFormatter ? labelFormatter(label) : label}</p>}
      {rows.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="num flex items-center gap-2 text-text-0">
          <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="max-w-36 truncate text-text-1">{p.name}</span>
          <span className="ml-auto pl-3">{fmtHours(p.value as number)}</span>
        </p>
      ))}
      {rows.length > 1 && (
        <p className="num mt-1 flex border-t border-line pt-1 text-text-1">
          Total <span className="ml-auto text-text-0">{fmtHours(total)}</span>
        </p>
      )}
    </div>
  );
}

const yHours = (v: number) => (v === 0 ? "0" : `${Math.round(v / 60)}h`);

/** Marcas do eixo em horas cheias (1h, 2h, 5h, 10h…), no máximo ~4 linhas. */
export function hourTicks(maxMinutes: number): number[] {
  const maxH = Math.max(1, Math.ceil(maxMinutes / 60));
  const step = [1, 2, 3, 5, 10, 15, 20, 25, 50].find((s) => maxH / s <= 4) ?? 100;
  const top = Math.ceil(maxH / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step * 60);
}

export interface Series {
  key: string;
  name: string;
  color: string;
}

/** Barras empilhadas por projeto (dia a dia da semana/mês), com a meta diária tracejada. */
export function StackedDaysChart({
  data,
  series,
  goalMinutes,
  xLabel,
  tooltipLabel,
  highlight,
}: {
  data: Record<string, number | string>[];
  series: Series[];
  goalMinutes?: number;
  xLabel: (v: string) => string;
  tooltipLabel: (v: string) => string;
  highlight?: string;
}) {
  const max = Math.max(goalMinutes ?? 0, ...data.map((r) => series.reduce((s, x) => s + (Number(r[x.key]) || 0), 0)));
  const ticks = hourTicks(max);
  return (
    <div className="h-56 w-full" role="img" aria-label="Horas por dia, por projeto">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CHART.line} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={({ x, y, payload }) => (
              <text x={x} y={Number(y) + 12} textAnchor="middle" {...CHART.tick} fill={payload.value === highlight ? "var(--text-0)" : CHART.tick.fill}>
                {xLabel(String(payload.value))}
              </text>
            )}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={6}
          />
          <YAxis domain={[0, ticks.at(-1)!]} ticks={ticks} tickFormatter={yHours} tick={CHART.tick} axisLine={false} tickLine={false} width={32} />
          <Tooltip cursor={{ fill: "var(--line)" }} content={<TimeTooltip labelFormatter={(l) => tooltipLabel(String(l))} />} />
          {goalMinutes ? <ReferenceLine y={goalMinutes} stroke="var(--plasma)" strokeDasharray="4 4" strokeOpacity={0.7} /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="t"
              fill={s.color}
              maxBarSize={28}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rosca de horas por projeto, com o total no meio. */
export function ProjectDonut({ slices, total }: { slices: { name: string; minutes: number; color: string }[]; total: number }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[13rem]" role="img" aria-label="Divisão das horas por projeto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices.length ? slices : [{ name: "vazio", minutes: 1, color: "var(--line)" }]}
            dataKey="minutes"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {(slices.length ? slices : [{ color: "var(--line)" }]).map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
          {slices.length > 0 && <Tooltip content={<TimeTooltip />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="num font-display text-2xl text-text-0">{fmtHours(total)}</span>
        <span className="text-xs text-text-2">no período</span>
      </div>
    </div>
  );
}

/** Evolução (semanas ou meses): barra Plasma, a atual em destaque, média tracejada. */
export function EvolutionChart({
  data,
  xLabel,
  tooltipLabel,
}: {
  data: { key: string; minutes: number; current: boolean }[];
  xLabel: (v: string) => string;
  tooltipLabel: (v: string) => string;
}) {
  const past = data.filter((d) => !d.current);
  const avg = past.length ? past.reduce((s, d) => s + d.minutes, 0) / past.length : 0;
  const ticks = hourTicks(Math.max(...data.map((d) => d.minutes)));
  return (
    <div className="h-48 w-full" role="img" aria-label="Evolução das horas de foco">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={CHART.line} strokeDasharray="3 3" />
          <XAxis
            dataKey="key"
            tickFormatter={(v: string) => xLabel(v)}
            tick={CHART.tick}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis domain={[0, ticks.at(-1)!]} ticks={ticks} tickFormatter={yHours} tick={CHART.tick} axisLine={false} tickLine={false} width={36} />
          <Tooltip cursor={{ fill: "var(--line)" }} content={<TimeTooltip labelFormatter={(l) => tooltipLabel(String(l))} />} />
          {avg > 0 && <ReferenceLine y={avg} stroke="var(--text-2)" strokeDasharray="4 4" />}
          <Bar dataKey="minutes" name="Foco" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill="var(--plasma)" fillOpacity={d.current ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horas ao longo do dia (para a visão Dia). */
export function HoursOfDayChart({ hours }: { hours: number[] }) {
  const data = hours.map((m, h) => ({ h: String(h), minutes: m })).slice(5);
  return (
    <div className="h-48 w-full" role="img" aria-label="Minutos de foco por hora do dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="15%">
          <CartesianGrid vertical={false} stroke={CHART.line} strokeDasharray="3 3" />
          <XAxis dataKey="h" tickFormatter={(v: string) => `${v}h`} tick={CHART.tick} axisLine={false} tickLine={false} interval={2} />
          <YAxis domain={[0, 60]} ticks={[0, 30, 60]} tickFormatter={(v: number) => `${v}m`} tick={CHART.tick} axisLine={false} tickLine={false} width={32} />
          <Tooltip cursor={{ fill: "var(--line)" }} content={<TimeTooltip labelFormatter={(l) => `${l}h–${Number(l) + 1}h`} />} />
          <Bar dataKey="minutes" name="Foco" fill="var(--plasma)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const WD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Mapa de calor dia da semana × hora (6h–23h). Intensidade Plasma pela fração do máximo. */
export function HourHeatmap({ grid }: { grid: number[][] }) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="w-full overflow-x-auto [scrollbar-width:none]">
      <table className="w-full border-separate border-spacing-[3px]" aria-label="Quando você mais foca">
        <thead>
          <tr>
            <th className="w-8" />
            {hours.map((h) => (
              <th key={h} scope="col" className="num p-0 text-xs font-normal text-text-2">
                {h % 3 === 0 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, d) => (
            <tr key={d}>
              <th scope="row" className="pr-1 text-left text-xs font-normal text-text-2">
                {WD[d]}
              </th>
              {hours.map((h) => {
                const m = row[h] ?? 0;
                const k = m / max;
                return (
                  <td
                    key={h}
                    title={`${WD[d]} ${h}h: ${fmtHours(m)}`}
                    className={cn("h-4 min-w-3 rounded-[3px] p-0", m === 0 && "bg-white/[0.04]")}
                    style={m > 0 ? { background: `rgba(124, 92, 255, ${0.18 + 0.82 * k})`, boxShadow: k > 0.7 ? "0 0 6px rgba(124,92,255,0.5)" : undefined } : undefined}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
