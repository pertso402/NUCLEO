import Link from "next/link";
import { formatShortDate } from "@/lib/dates";
import type { PaceResult } from "@/lib/metrics/pace";
import { HudCard } from "./HudCard";
import { Money } from "./Money";
import { PaceBar } from "./PaceBar";
import { RingProgress } from "./RingProgress";
import { StatTicker } from "./StatTicker";

export interface HeroMilestone {
  title: string;
  metricLabel: string;
  deadline: string | null;
}

/** Hero do Comando (DESIGN §9): anel, faltam R$ X, barra de ritmo e projeção. */
export function MilestoneHero({ milestone, pace }: { milestone: HeroMilestone; pace: PaceResult }) {
  const pctLabel = Math.floor(pace.pct * 100);
  return (
    <HudCard
      variant="target"
      onTrack={pace.onTrack && !pace.achieved}
      accent={pace.achieved ? "gold" : "volt"}
      label="Marco em destaque"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="text-center">
          <h2 className="neon-white font-display text-lg font-semibold text-text-0">{milestone.title}</h2>
          <p className="mt-1 text-xs text-text-2">
            {milestone.metricLabel}
            {milestone.deadline && <> · até {formatShortDate(milestone.deadline)}</>}
          </p>
        </div>

        <RingProgress
          value={pace.pct}
          expected={pace.expectedPct}
          onTrack={pace.onTrack}
          achieved={pace.achieved}
        >
          <StatTicker cents={pace.currentCents} showCents={false} className="neon-white text-2xl lg:text-3xl" />
          <span className="mt-1 text-sm text-text-2">
            de <Money cents={pace.targetCents} showCents={false} className="text-sm" />
          </span>
          <span className={`num mt-2 text-sm ${pace.achieved ? "neon-gold" : "neon-volt"}`}>{pctLabel}%</span>
        </RingProgress>

        {pace.achieved ? (
          <p className="neon-gold text-center text-sm">Marco batido.</p>
        ) : (
          <div className="w-full text-center">
            <p className="label-instrument">Faltam</p>
            <Money cents={pace.remainingCents} showCents={false} className="neon-white text-3xl lg:text-4xl" />
          </div>
        )}

        <div className="w-full">
          <PaceBar value={Math.min(pace.pct, 1)} expected={pace.expectedPct} />
          <div className="mt-3 flex items-center justify-between text-xs text-text-2">
            <span>
              {pace.bdElapsed} de {pace.bdTotal} dias úteis
            </span>
            <span>
              {pace.bdLeft === 1 ? "1 restante" : `${pace.bdLeft} restantes`}
            </span>
          </div>
        </div>

        {!pace.achieved && (
          <dl className="grid w-full grid-cols-2 gap-2">
            <div className="edge-light rounded-sm border border-line bg-white/[0.025] p-3">
              <dt className="label-instrument">Precisa / dia</dt>
              <dd className="mt-1 text-lg">
                <Money
                  cents={Math.ceil(pace.paceNeededCents / 100) * 100}
                  showCents={false}
                  tone={pace.onTrack ? "default" : "ember"}
                />
              </dd>
            </div>
            <div className="edge-light rounded-sm border border-line bg-white/[0.025] p-3">
              <dt className="label-instrument">Ritmo / dia</dt>
              <dd className="mt-1 text-lg">
                <Money
                  cents={Math.floor(pace.paceCurrentCents / 100) * 100}
                  showCents={false}
                  tone={pace.onTrack ? "volt" : "default"}
                />
              </dd>
            </div>
          </dl>
        )}

        <p className={`text-center text-sm ${pace.achieved ? "text-gold" : pace.onTrack ? "text-text-1" : "text-ember"}`}>
          {pace.achieved ? (
            <Link href="/marcos" className="underline underline-offset-4">
              Ver próximo marco →
            </Link>
          ) : (
            pace.summary
          )}
        </p>
      </div>
    </HudCard>
  );
}
