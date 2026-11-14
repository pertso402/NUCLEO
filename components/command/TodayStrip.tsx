import Link from "next/link";
import { StatTile } from "@/components/hud/StatTile";
import type { TodayData } from "@/lib/data/today";

function fmtMin(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v}m`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

/** Faixa "Hoje" (DESIGN §9): Abordagens · Foco · Hábitos. Abordagens chega com o Pipeline (Fase 3). */
export function TodayStrip({ data }: { data: TodayData }) {
  const focusHit = data.focusGoalMinutes > 0 && data.focusMinutes >= data.focusGoalMinutes;
  const habitsHit = data.habitsExpected > 0 && data.habitsDone >= data.habitsExpected;
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile label={<span className="text-[10px] tracking-[0.02em]">Abordagens</span>} value={<span className="text-text-2">—</span>} unit={<span className="text-[10px]">pipeline</span>} />
      <Link href="/rotina?aba=tempo" className="min-w-0 rounded-md transition-transform duration-150 active:scale-[0.97]">
        <StatTile
          label="Foco"
          value={<span className={focusHit ? "neon-volt" : data.focusMinutes > 0 ? "text-plasma" : undefined}>{fmtMin(data.focusMinutes)}</span>}
          unit={data.workday ? `/${fmtMin(data.focusGoalMinutes)}` : "folga"}
          className="h-full"
        />
      </Link>
      <Link href="/rotina?aba=habitos" className="min-w-0 rounded-md transition-transform duration-150 active:scale-[0.97]">
        <StatTile
          label="Hábitos"
          value={<span className={habitsHit ? "neon-volt" : undefined}>{data.habitsDone}</span>}
          unit={data.habitsExpected > 0 ? `/${data.habitsExpected}` : "—"}
          className="h-full"
        />
      </Link>
    </div>
  );
}
