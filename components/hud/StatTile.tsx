import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Sufixo pequeno após o valor (ex.: "/ 8", "h"). */
  unit?: ReactNode;
  /** Delta: positivo = Volt ↑, negativo = Flare ↓. */
  delta?: { value: ReactNode; direction: "up" | "down" };
  sparkline?: ReactNode;
  className?: string;
}

export function StatTile({ label, value, unit, delta, sparkline, className }: StatTileProps) {
  return (
    <div className={cn("glass edge-light flex min-w-0 flex-col gap-1 rounded-md border border-line p-3", className)}>
      <span className="label-instrument truncate">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="num text-xl text-text-0">{value}</span>
        {unit && <span className="num text-xs text-text-2">{unit}</span>}
      </div>
      {delta && (
        <span
          className={cn("num text-xs", delta.direction === "up" ? "text-volt" : "text-flare")}
        >
          {delta.direction === "up" ? "↑" : "↓"} {delta.value}
        </span>
      )}
      {sparkline}
    </div>
  );
}
