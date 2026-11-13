"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortDate } from "@/lib/dates";
import type { CumulativePoint } from "@/lib/metrics/money-report";
import { formatCompactBRL } from "@/lib/money";
import { CHART, ChartTooltip } from "./chart-theme";

/** Receita acumulada no mês (linha Volt com gradiente para transparente). Meta opcional tracejada. */
export function CumulativeChart({ points, targetCents }: { points: CumulativePoint[]; targetCents?: number }) {
  const data = points.map((p) => ({ date: p.date, cents: p.cents }));
  const max = Math.max(targetCents ?? 0, ...points.map((p) => p.cents ?? 0));
  return (
    <div className="h-44 w-full" role="img" aria-label="Receita acumulada no mês">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="nucleo-cum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--volt)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--volt)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.line} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(8)}
            tick={CHART.tick}
            axisLine={false}
            tickLine={false}
            interval={6}
          />
          <YAxis
            domain={[0, max > 0 ? max : 100]}
            tickFormatter={(v: number) => formatCompactBRL(v)}
            tick={CHART.tick}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          {targetCents ? (
            <ReferenceLine y={targetCents} stroke={CHART.axis} strokeDasharray="4 4" ifOverflow="extendDomain" />
          ) : null}
          <Tooltip
            cursor={{ stroke: CHART.lineStrong }}
            content={<ChartTooltip labelFormatter={(l) => formatShortDate(String(l))} />}
          />
          <Area
            className="chart-glow-volt"
            type="monotone"
            dataKey="cents"
            name="Receita acumulada"
            stroke={CHART.volt}
            strokeWidth={2}
            fill="url(#nucleo-cum)"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3, fill: CHART.volt, stroke: "none" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
