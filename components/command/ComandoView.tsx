import Link from "next/link";
import { HudCard } from "@/components/hud/HudCard";
import { MilestoneHero } from "@/components/hud/MilestoneHero";
import type { HighlightMilestone } from "@/lib/data/comando";
import type { TodayData } from "@/lib/data/today";
import { formatLongDate } from "@/lib/dates";
import { PrincipleCard } from "./PrincipleCard";
import { RevenueTasks } from "./RevenueTasks";
import { ScoreRing } from "./ScoreRing";
import { TodayStrip } from "./TodayStrip";

function greeting(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Comando (ARCHITECTURE §7.1, DESIGN §9). Mobile: topo com score · hero · faixa Hoje ·
 * movem faturamento · princípio. Desktop: hero em 7 colunas e o resto em 5.
 */
export function ComandoView({ highlight, today, hour }: { highlight: HighlightMilestone | null; today: TodayData; hour: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <header className="flex items-center justify-between gap-3 lg:col-span-12">
        <div className="min-w-0">
          <p className="label-instrument mb-1 first-letter:uppercase">{formatLongDate(today.today)}</p>
          <h1 className="font-display text-xl font-semibold text-text-0">{greeting(hour)}, Peter.</h1>
        </div>
        <Link href="/rotina" className="flex items-center gap-2 rounded-full transition-transform duration-150 active:scale-95" aria-label="Score do dia: ver a rotina">
          <span className="label-instrument hidden text-right sm:block">
            Score
            <br />
            do dia
          </span>
          <ScoreRing score={today.score.score} />
        </Link>
      </header>

      <div className="lg:col-span-7">
        {highlight ? (
          <MilestoneHero milestone={highlight.milestone} pace={highlight.pace} />
        ) : (
          <HudCard variant="target" label="Marco em destaque">
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-text-2">Nenhum marco ativo.</p>
              <Link href="/marcos" className="text-sm text-volt underline underline-offset-4">
                Criar marco →
              </Link>
            </div>
          </HudCard>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:col-span-5">
        <TodayStrip data={today} />
        <RevenueTasks tasks={today.revenueTasks} doneToday={today.revenueDoneToday} today={today.today} />
        <PrincipleCard principle={today.principle} />
      </div>
    </div>
  );
}
