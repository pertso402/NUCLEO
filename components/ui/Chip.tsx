import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * stage = etapa do lead (Ion) · category = categoria (bg-3) ·
 * alert = atenção (Ember) · neutral
 */
type Tone = "stage" | "category" | "alert" | "neutral";

const tones: Record<Tone, string> = {
  stage: "border-ion/40 bg-ion/10 text-ion shadow-[0_0_10px_rgba(46,230,255,0.25)]",
  category: "bg-white/[0.05] border-line text-text-1",
  alert: "border-ember/50 bg-ember/10 text-ember shadow-[0_0_10px_rgba(255,138,42,0.3)]",
  neutral: "border-line-strong text-text-1",
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Chip({ tone = "neutral", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
