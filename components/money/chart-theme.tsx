"use client";

import type { ReactNode } from "react";
import { formatBRL } from "@/lib/money";

/** Tokens do DESIGN §8 para o Recharts (SVG lê as CSS vars). */
export const CHART = {
  volt: "var(--volt)",
  flare: "var(--flare)",
  line: "var(--line)",
  lineStrong: "var(--line-strong)",
  axis: "var(--text-2)",
  tick: { fill: "var(--text-2)", fontSize: 11, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" },
} as const;

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | null;
  color?: string;
}

/** Tooltip `--bg-3` com borda `--line-strong`. Valores em centavos. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: ReactNode;
  labelFormatter?: (label: ReactNode) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => typeof p.value === "number");
  if (!rows.length) return null;
  return (
    <div className="rounded-sm border border-line-strong bg-bg-3 px-3 py-2 text-xs">
      <p className="mb-1 text-text-2">{labelFormatter ? labelFormatter(label) : label}</p>
      {rows.map((p) => (
        <p key={String(p.dataKey)} className="num flex items-center gap-2 text-text-0">
          <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-1">{p.name}</span>
          <span className="ml-auto pl-3">{formatBRL(p.value as number)}</span>
        </p>
      ))}
    </div>
  );
}
