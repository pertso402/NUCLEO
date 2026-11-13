import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface RingProgressProps {
  /** Progresso 0..1 (acima de 1 fecha o anel). */
  value: number;
  /** "Onde deveria estar hoje" 0..1 — desenha um tick no anel. */
  expected?: number;
  /** Cor do tick: Volt fino quando no ritmo, Ember quando atrás. */
  onTrack?: boolean;
  /** Ouro: só para marco batido (DESIGN §6). */
  achieved?: boolean;
  className?: string;
  children?: ReactNode;
}

const SIZE = 240;
const STROKE = 10;
const R = (SIZE - STROKE) / 2 - 6;
const C = 2 * Math.PI * R;

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

/** Anel de progresso do marco (DESIGN §5.3). SVG puro: renderiza no servidor. */
export function RingProgress({ value, expected, onTrack = false, achieved = false, className, children }: RingProgressProps) {
  const v = clamp01(value);
  const arc = C * v;
  const color = achieved ? "var(--gold)" : "var(--volt)";
  const glow = achieved ? "drop-shadow(0 0 10px rgba(255,210,74,.45))" : "drop-shadow(0 0 8px rgba(200,255,46,.35))";

  // Tick "onde deveria estar": ângulo a partir do topo, sentido horário.
  let tick: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (expected !== undefined && !achieved && expected > 0 && expected < 1) {
    const a = 2 * Math.PI * expected - Math.PI / 2;
    const inner = R - STROKE;
    const outer = R + STROKE;
    const cx = SIZE / 2;
    tick = {
      x1: cx + inner * Math.cos(a),
      y1: cx + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a),
      y2: cx + outer * Math.sin(a),
    };
  }

  return (
    <div className={cn("relative aspect-square w-60 lg:w-72", className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--line-strong)" strokeWidth={STROKE} />
        {v > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${C}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ filter: glow }}
          />
        )}
        {tick && (
          <line
            {...tick}
            stroke={onTrack ? "var(--volt)" : "var(--ember)"}
            strokeWidth={onTrack ? 1.5 : 2.5}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
