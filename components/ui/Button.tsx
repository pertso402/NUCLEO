import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** focus = ação de tempo/foco (Plasma, DESIGN §2); o resto da paleta de sinais não vira botão. */
type Variant = "primary" | "focus" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-volt text-bg-0 shadow-[0_0_10px_rgba(200,255,46,0.35)] hover:shadow-glow-volt disabled:shadow-none",
  focus:
    "bg-plasma text-text-0 shadow-[0_0_10px_rgba(124,92,255,0.45)] hover:shadow-glow-plasma disabled:shadow-none",
  secondary: "bg-white/[0.05] text-text-0 border border-line-strong hover:border-text-2 hover:bg-white/[0.08]",
  ghost: "bg-transparent text-text-1 hover:text-text-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({
  variant = "primary",
  block = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold",
        "transition-[box-shadow,border-color,color,background-color,transform] duration-150 ease-out active:scale-[0.96]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
