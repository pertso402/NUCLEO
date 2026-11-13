import { HudCard } from "@/components/hud/HudCard";
import { MilestoneHero } from "@/components/hud/MilestoneHero";
import type { HighlightMilestone, MilestonesOverview } from "@/lib/data/milestone";
import { AchievementTimeline, ArchivedList } from "./AchievementTimeline";
import { MilestoneQueue } from "./MilestoneQueue";

/** Corpo da tela Marcos (server component): destaque, fila, conquistas e arquivados. */
export function MarcosView({
  highlight,
  overview,
  months,
  today,
}: {
  highlight: HighlightMilestone | null;
  overview: MilestonesOverview;
  months: { value: string; label: string }[];
  today: string;
}) {
  const conquistas = overview.achieved.length;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <header className="lg:col-span-12">
        <p className="label-instrument mb-1">Marcos</p>
        <h1 className="neon-white font-display text-xl font-semibold text-text-0">A escada</h1>
        <p className="mt-1 text-sm text-text-2">
          {conquistas === 0
            ? "Um degrau de cada vez. O primeiro da fila é o destaque do Comando."
            : `${conquistas} ${conquistas === 1 ? "marco batido" : "marcos batidos"} até aqui.`}
        </p>
      </header>

      <div className="lg:col-span-7">
        {highlight ? (
          <MilestoneHero milestone={highlight.milestone} pace={highlight.pace} />
        ) : (
          <HudCard variant="target" label="Marco em destaque">
            <p className="py-10 text-center text-sm text-text-2">Nenhum marco ativo. Crie o próximo na fila.</p>
          </HudCard>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:col-span-5">
        <MilestoneQueue items={overview.active} months={months} today={today} />
        <HudCard label="Conquistas" accent="gold">
          <AchievementTimeline items={overview.achieved} />
        </HudCard>
        <ArchivedList items={overview.archived} />
      </div>
    </div>
  );
}
