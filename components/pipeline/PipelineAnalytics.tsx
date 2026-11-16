import { HudCard } from "@/components/hud/HudCard";
import { Money } from "@/components/hud/Money";
import { cn } from "@/lib/cn";
import type { PipelineAnalytics as Data } from "@/lib/data/pipeline-analytics";
import { MIN_SAMPLE, RATE_STEPS } from "@/lib/metrics/funnel";
import { LOST_REASONS, ORIGINS } from "@/lib/metrics/pipeline";

const LOST = Object.fromEntries(LOST_REASONS.map((r) => [r.value, r.label]));
const ORIGIN = Object.fromEntries(ORIGINS.map((o) => [o.value, o.label]));
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Barra horizontal fina (anima só transform). */
function Bar({ value, tone }: { value: number; tone: "ion" | "flare" | "volt" }) {
  const color = { ion: "bg-ion shadow-glow-ion", flare: "bg-flare/80", volt: "bg-volt shadow-glow-volt" }[tone];
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06]">
      <div className={cn("h-full origin-left rounded-full", color)} style={{ transform: `scaleX(${Math.min(Math.max(value, 0), 1)})` }} />
    </div>
  );
}

/** Análises do pipeline (ARCHITECTURE §7.6): conversão por etapa, motivos de perda, origem que mais fecha. */
export function PipelineAnalytics({ data }: { data: Data }) {
  return (
    <section aria-label="Análises" className="flex flex-col gap-3">
      <h2 className="label-instrument">Análises</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HudCard label="Conversão por etapa" accent="ion" action={<span className="text-xs text-text-2">90 dias</span>}>
          <ul className="flex flex-col gap-3">
            {RATE_STEPS.map((s) => {
              const c = data.stages[s.key];
              const rate = c.sample ? c.advanced / c.sample : 0;
              return (
                <li key={s.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-text-1 first-letter:uppercase">{s.label}</span>
                    <span className="num shrink-0 text-xs text-text-2">
                      {c.advanced}/{c.sample} ·{" "}
                      <span className={c.sample >= MIN_SAMPLE ? "text-ion" : "text-text-2"}>{c.sample ? pct(rate) : "—"}</span>
                    </span>
                  </div>
                  <Bar value={rate} tone="ion" />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-text-2">
            Com menos de {MIN_SAMPLE} leads numa etapa, o funil reverso usa a taxa padrão (aparece em cinza).
          </p>
        </HudCard>

        <HudCard label="Motivos de perda" accent="flare" action={<span className="text-xs text-text-2">180 dias</span>}>
          {data.lost.total === 0 ? (
            <p className="text-sm text-text-2">Nenhum lead perdido no período.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.lost.items.map((i) => (
                <li key={i.reason}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-text-1">{LOST[i.reason]}</span>
                    <span className="num text-xs text-text-2">
                      {i.count} · {pct(i.share)}
                    </span>
                  </div>
                  <Bar value={i.share} tone="flare" />
                </li>
              ))}
            </ul>
          )}
        </HudCard>

        <HudCard label="Origem que mais fecha" accent="volt" action={<span className="text-xs text-text-2">180 dias</span>}>
          {data.origins.length === 0 ? (
            <p className="text-sm text-text-2">Sem leads no período.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.origins.map((o, i) => (
                <li key={o.origin}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className={cn("truncate", i === 0 && o.closed > 0 ? "text-text-0" : "text-text-1")}>{ORIGIN[o.origin]}</span>
                    <span className="num shrink-0 text-xs text-text-2">
                      {o.closed}/{o.leads} · {pct(o.closeRate)}
                      {o.mrrCents > 0 && (
                        <>
                          {" · "}
                          <Money cents={o.mrrCents} showCents={false} tone="volt" className="text-xs" />
                          /mês
                        </>
                      )}
                    </span>
                  </div>
                  <Bar value={o.closeRate} tone="volt" />
                </li>
              ))}
            </ul>
          )}
        </HudCard>
      </div>
    </section>
  );
}
