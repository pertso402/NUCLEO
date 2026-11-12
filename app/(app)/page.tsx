import { HudCard } from "@/components/hud/HudCard";
import { StatTile } from "@/components/hud/StatTile";

export default function ComandoPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <header className="lg:col-span-12">
        <p className="label-instrument mb-1">Comando</p>
        <h1 className="font-display text-xl font-semibold text-text-0">Olá, Peter.</h1>
      </header>

      <HudCard variant="target" label="Marco em destaque" className="lg:col-span-7">
        <div className="flex min-h-60 flex-col items-center justify-center gap-2 text-center">
          <span className="num text-3xl text-text-0 lg:text-4xl">—</span>
          <p className="text-sm text-text-2">Nenhum marco configurado ainda.</p>
        </div>
      </HudCard>

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
