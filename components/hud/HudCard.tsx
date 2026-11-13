import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Accent = "none" | "volt" | "plasma" | "ion" | "flare" | "gold";

export interface HudCardProps extends HTMLAttributes<HTMLElement> {
  label?: ReactNode;
  /** "target" desenha os 4 cantos de mira (usar só no hero e em 1–2 cards-chave). */
  variant?: "default" | "target";
  /** Com variant="target": cantos ficam Volt (com brilho) quando o card representa algo no ritmo. */
  onTrack?: boolean;
  /** Cor do filete de luz no topo do card (sinal do conteúdo). Padrão: filete branco discreto. */
  accent?: Accent;
  /** Vidro com desfoque (padrão). Desligue em cards dentro de listas longas. */
  glass?: boolean;
  action?: ReactNode;
}

const corners = [
  "left-0 top-0 border-l-2 border-t-2 rounded-tl-md",
  "right-0 top-0 border-r-2 border-t-2 rounded-tr-md",
  "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-md",
  "right-0 bottom-0 border-r-2 border-b-2 rounded-br-md",
];

const edge: Record<Accent, string> = {
  none: "rgba(255,255,255,0.18)",
  volt: "rgba(200,255,46,0.85)",
  plasma: "rgba(124,92,255,0.85)",
  ion: "rgba(46,230,255,0.8)",
  flare: "rgba(255,61,110,0.8)",
  gold: "rgba(255,210,74,0.9)",
};

const dot: Record<Accent, string> = {
  none: "bg-text-2",
  volt: "bg-volt shadow-glow-volt",
  plasma: "bg-plasma shadow-glow-plasma",
  ion: "bg-ion shadow-glow-ion",
  flare: "bg-flare shadow-glow-flare",
  gold: "bg-gold shadow-glow-gold",
};

export function HudCard({
  label,
  variant = "default",
  onTrack = false,
  accent = "none",
  glass = true,
  action,
  className,
  children,
  ...props
}: HudCardProps) {
  return (
    <section
      className={cn(
        "edge-light relative rounded-md border border-line p-4",
        glass ? "glass" : "bg-bg-2",
        className,
      )}
      {...props}
    >
      {/* Filete de luz no topo */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -top-px h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${edge[accent]}, transparent)` }}
      />
      {variant === "target" &&
        corners.map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={cn(
              "pointer-events-none absolute size-3.5",
              pos,
              onTrack ? "border-volt shadow-glow-volt" : "border-text-2/70",
            )}
          />
        ))}
      {(label || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {label && (
            <h2 className="label-instrument flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", dot[accent])}
              />
              {label}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
