"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonthLong, formatMonthShort } from "@/lib/dates";
import type { MonthTotals } from "@/lib/metrics/money-report";
import { formatCompactBRL } from "@/lib/money";
import { CHART, ChartTooltip } from "./chart-theme";

/** Evolução de 12 meses: receita (Volt) × despesa (Flare). */
export function MonthlyBarsChart({ series, selected }: { series: MonthTotals[]; selected: string }) {
  const data = series.map((m) => ({
    month: m.month,
    income: m.incomeCents,
    expense: m.expenseCents,
  }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Receita e despesa dos últimos 12 meses">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={CHART.line} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={({ x, y, payload }) => (
              <text
                x={x}
                y={Number(y) + 12}
                textAnchor="middle"
                {...CHART.tick}
                fill={payload.value === selected ? "var(--text-0)" : CHART.tick.fill}
              >
                {formatMonthShort(payload.value as string)}
              </text>
            )}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={4}
          />
          <YAxis
            domain={[0, (dataMax: number) => (dataMax > 0 ? dataMax : 100_000)]}
            tickFormatter={(v: number) => formatCompactBRL(v)}
            tick={CHART.tick}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={<ChartTooltip labelFormatter={(l) => formatMonthLong(String(l))} />}
          />
          <Bar className="chart-glow-volt" dataKey="income" name="Receita" fill={CHART.volt} radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Bar className="chart-glow-flare" dataKey="expense" name="Despesa" fill={CHART.flare} radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
