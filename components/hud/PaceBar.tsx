import { cn } from "@/lib/cn";

export interface PaceBarProps {
  /** Onde você está (0..1). */
  value: number;
  /** Onde deveria estar hoje (0..1). */
  expected: number;
  className?: string;
}

function pct(n: number) {
  return `${Math.min(Math.max(n, 0), 1) * 100}%`;
}

/**
 * Barra de ritmo (DESIGN §5.5): Volt = onde você está; linha `--text-2` = onde deveria estar.
 * A diferença entre as duas fica Volt (à frente) ou Ember (atrás).
 */
export function PaceBar({ value, expected, className }: PaceBarProps) {
  const ahead = value >= expected;
  const lo = Math.min(value, expected);
  const hi = Math.max(value, expected);
  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-2 w-full rounded-full bg-white/[0.06]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-volt shadow-glow-volt" style={{ width: pct(lo) }} />
        <div
          className={cn("absolute inset-y-0 rounded-r-full", ahead ? "bg-volt shadow-glow-volt" : "bg-ember/30")}
          style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
        />
      </div>
      <div className="relative h-0">
        <span
          aria-hidden
          className="absolute -top-3.5 h-5 w-0.5 rounded-full bg-text-0 shadow-[0_0_8px_rgba(242,244,248,0.6)]"
          style={{ left: pct(expected) }}
        />
      </div>
    </div>
  );
}
