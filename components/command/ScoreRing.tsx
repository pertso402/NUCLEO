import { cn } from "@/lib/cn";

/**
 * Score do dia num anel pequeno (DESIGN §9: topo do Comando). Volt acende conforme sobe;
 * a partir de 70 ganha brilho (o brilho é conquistado).
 */
export function ScoreRing({ score, size = 56, className }: { score: number; size?: number; className?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const lit = score >= 70;
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score do dia: ${score} de 100`}
    >
      <svg viewBox="0 0 52 52" className="size-full -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(200,255,46,0.08)" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="var(--volt)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(c * pct).toFixed(2)} ${c.toFixed(2)}`}
          className={lit ? "chart-glow-volt" : undefined}
          opacity={score > 0 ? 1 : 0}
        />
      </svg>
      <span
        className={cn(
          "num absolute inset-0 flex items-center justify-center text-base font-medium",
          lit ? "neon-volt" : score > 0 ? "text-text-0" : "text-text-2",
        )}
      >
        {score}
      </span>
    </div>
  );
}
