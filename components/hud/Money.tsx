import { brlParts, type Cents } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Valor em reais no padrão do DESIGN §3: "R$" a 50% e `--text-1`, inteiro em destaque,
 * centavos em `--text-2`. Herda o tamanho da fonte do pai.
 */
export function Money({
  cents,
  showCents = true,
  tone = "default",
  className,
}: {
  cents: Cents;
  showCents?: boolean;
  /** Cor do número: default (`--text-0`), volt (no ritmo/receita), ember (atenção), flare (despesa). */
  tone?: "default" | "volt" | "ember" | "flare";
  className?: string;
}) {
  const p = brlParts(cents);
  const toneClass = { default: "text-text-0", volt: "neon-volt", ember: "text-ember", flare: "neon-flare" }[tone];
  return (
    <span className={cn("num whitespace-nowrap", className)}>
      <span className="mr-[0.15em] align-baseline text-[0.5em] text-text-1">
        {p.sign}
        {p.symbol}
      </span>
      <span className={toneClass}>{p.integer}</span>
      {showCents && <span className="text-[0.6em] text-text-2">,{p.decimal}</span>}
    </span>
  );
}
