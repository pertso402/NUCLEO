import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * stage = etapa do lead (Ion) · arte = scope ARTe (Volt-dim) ·
 * pessoal = scope pessoal (bg-3) · alert = atenção (Ember) · neutral
 */
type Tone = "stage" | "arte" | "pessoal" | "alert" | "neutral";

const tones: Record<Tone, string> = {
  stage: "border-ion/30 text-ion",
  arte: "bg-volt-dim border-transparent text-volt",
  pessoal: "bg-bg-3 border-transparent text-text-1",
  alert: "border-ember/40 text-ember",
  neutral: "border-line-strong text-text-1",
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Chip({ tone = "neutral", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
