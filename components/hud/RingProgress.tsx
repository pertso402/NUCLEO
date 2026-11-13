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

const SIZE = 260;
const CX = SIZE / 2;
const STROKE = 10;
const R = 104;
const C = 2 * Math.PI * R;
const TICKS = 60;

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

function polar(r: number, frac: number) {
  const a = 2 * Math.PI * frac - Math.PI / 2;
  return { x: CX + r * Math.cos(a), y: CX + r * Math.sin(a) };
}

/**
 * Anel de progresso do marco (DESIGN §5.3) em estilo gauge de HUD: escala de 60 marcas por fora,
 * trilho, arco em gradiente com brilho duplo e um ponto de luz na ponta. SVG puro: renderiza no servidor.
 */
export function RingProgress({ value, expected, onTrack = false, achieved = false, className, children }: RingProgressProps) {
  const v = clamp01(value);
  const arc = C * v;
  const [c1, c2] = achieved ? ["#FFD24A", "#FFF1B8"] : ["#C8FF2E", "#E9FFA6"];
  const glow = achieved
    ? "drop-shadow(0 0 6px rgba(255,210,74,.8)) drop-shadow(0 0 18px rgba(255,210,74,.45))"
    : "drop-shadow(0 0 6px rgba(200,255,46,.75)) drop-shadow(0 0 18px rgba(200,255,46,.4))";
  const tip = polar(R, v);
  const gid = achieved ? "ring-grad-gold" : "ring-grad-volt";

  let tick: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (expected !== undefined && !achieved && expected > 0 && expected < 1) {
    const a = polar(R - STROKE - 2, expected);
    const b = polar(R + STROKE + 2, expected);
    tick = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  return (
    <div className={cn("relative aspect-square w-64 lg:w-76", className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <radialGradient id="ring-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={achieved ? "rgba(255,210,74,0.10)" : "rgba(200,255,46,0.08)"} />
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Brilho interno */}
        <circle cx={CX} cy={CX} r={R - STROKE} fill="url(#ring-core)" />

        {/* Escala externa: 60 marcas, as de 5 em 5 maiores; acendem até o progresso */}
        {Array.from({ length: TICKS }, (_, i) => {
          const f = i / TICKS;
          const major = i % 5 === 0;
          const a = polar(R + STROKE + 6, f);
          const b = polar(R + STROKE + (major ? 14 : 10), f);
          const lit = f < v;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lit ? c1 : "rgba(255,255,255,0.2)"}
              strokeOpacity={lit ? (major ? 0.9 : 0.55) : 1}
              strokeWidth={major ? 1.5 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Anel fino interno tracejado */}
        <circle
          cx={CX}
          cy={CX}
          r={R - STROKE - 8}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
          strokeDasharray="2 6"
        />

        {/* Trilho */}
        <circle cx={CX} cy={CX} r={R} fill="none" stroke="rgba(200,255,46,0.07)" strokeWidth={STROKE} />

        {v > 0 && (
          <>
            <circle
              cx={CX}
              cy={CX}
              r={R}
              fill="none"
              stroke={`url(#${gid})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${C}`}
              transform={`rotate(-90 ${CX} ${CX})`}
              style={{ filter: glow }}
            />
            {/* Ponto de luz na ponta do arco */}
            {v < 1 && <circle cx={tip.x} cy={tip.y} r={4} fill="#F7FFE0" style={{ filter: glow }} />}
          </>
        )}

        {tick && (
          <line
            {...tick}
            stroke={onTrack ? "var(--volt)" : "var(--ember)"}
            strokeWidth={onTrack ? 1.5 : 2.5}
            strokeLinecap="round"
            style={{ filter: onTrack ? undefined : "drop-shadow(0 0 4px rgba(255,138,42,.8))" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
