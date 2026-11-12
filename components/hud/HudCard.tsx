import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface HudCardProps extends HTMLAttributes<HTMLElement> {
  label?: ReactNode;
  /** "target" desenha os 4 cantos de mira (usar só no hero e em 1–2 cards-chave). */
  variant?: "default" | "target";
  /** Com variant="target": cantos ficam Volt quando o card representa algo no ritmo. */
  onTrack?: boolean;
  action?: ReactNode;
}

const corners = [
  "left-0 top-0 border-l border-t",
  "right-0 top-0 border-r border-t",
  "left-0 bottom-0 border-l border-b",
  "right-0 bottom-0 border-r border-b",
];

export function HudCard({
  label,
  variant = "default",
  onTrack = false,
  action,
  className,
  children,
  ...props
}: HudCardProps) {
  return (
    <section
      className={cn("relative rounded-md border border-line bg-bg-2 p-4", className)}
      {...props}
    >
      {variant === "target" &&
        corners.map((pos) => (
          <span
            key={pos}
            aria-hidden
            className={cn(
              "pointer-events-none absolute size-2.5",
              pos,
              onTrack ? "border-volt" : "border-line-strong",
            )}
          />
        ))}
      {(label || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {label && <h2 className="label-instrument">{label}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
