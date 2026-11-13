import Link from "next/link";
import { HudCard } from "@/components/hud/HudCard";
import { MilestoneHero } from "@/components/hud/MilestoneHero";
import { StatTile } from "@/components/hud/StatTile";
import { formatLongDate, hourInSP, todayISO } from "@/lib/dates";
import { getHighlightMilestone } from "@/lib/data/comando";

function greeting(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function ComandoPage() {
  const now = new Date();
  const highlight = await getHighlightMilestone(now);

  return (
    <div className="grid gap-4 lg:grid-cols-12">

      <header className="lg:col-span-12">
        <p className="label-instrument mb-1 first-letter:uppercase">{formatLongDate(todayISO(now))}</p>
        <h1 className="font-display text-xl font-semibold text-text-0">{greeting(hourInSP(now))}, Peter.</h1>
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
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Abordagens" value="—" />
          <StatTile label="Foco" value="—" />
          <StatTile label="Hábitos" value="—" />
        </div>
        <HudCard label="Princípio do dia">
          <p className="text-base text-text-1 italic">Lançar tem que ser mais fácil que esquecer.</p>
        </HudCard>
      </div>
    </div>
  );
}
