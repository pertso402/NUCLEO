import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { DailyReview } from "@/components/review/DailyReview";
import { ReviewTabs } from "@/components/review/ReviewTabs";
import { WeekReview } from "@/components/review/WeekReview";
import { PageHeader } from "@/components/ui/PageHeader";
import type { TodayData } from "@/lib/data/today";
import { computeScore } from "@/lib/metrics/score";
import type { WeekNumbers } from "@/lib/metrics/week";

/**
 * Vitrine de desenvolvimento da Revisão com dados fictícios (404 em produção).
 * `?aba=semana` para a revisão semanal. Não use os botões de salvar aqui: eles falam com o banco de verdade.
 */
const input = { revenueTasksPlanned: 3, revenueTasksDone: 2, focusMinutes: 165, habitsExpected: 3, habitsDone: 2 };
const DAY: TodayData = {
  today: "2026-11-13",
  workday: true,
  score: computeScore({ workday: true, outreachDone: null, outreachGoal: null, focusGoalMinutes: 240, ...input }),
  focusMinutes: 165,
  focusGoalMinutes: 240,
  habitsExpected: 3,
  habitsDone: 2,
  revenueTasks: [],
  revenueDoneToday: 2,
  revenuePlanned: 3,
  principle: null,
};

const CUR: WeekNumbers = {
  incomeCents: 230_000,
  expenseCents: 42_000,
  netCents: 188_000,
  focusMinutes: 750,
  tasksDone: 14,
  revenueTasksDone: 5,
  habitsDone: 18,
  habitsTarget: 24,
  avgScore: 62,
  reviewedDays: 4,
};
const PREV: WeekNumbers = { ...CUR, incomeCents: 80_000, expenseCents: 51_000, netCents: 29_000, focusMinutes: 540, tasksDone: 14, revenueTasksDone: 3, habitsDone: 20, avgScore: 55 };

export default async function DevRevisaoPage(props: PageProps<"/dev/revisao">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const week = sp.aba === "semana";
  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <PageHeader title="Revisão" kicker={week ? "Semana" : "sexta-feira, 13 de novembro"} />
        <ReviewTabs active={week ? "semana" : "hoje"} base="/dev/revisao" />
        {week ? (
          <WeekReview weekStart="2026-11-09" numbers={CUR} previous={PREV} review={null} current base="/dev/revisao" />
        ) : (
          <DailyReview
            day={DAY}
            saved={null}
            yesterdayTop3={["Mandar proposta pra Gelato", "Cobrar Choppatinhas", "Gravar vídeo do portfólio"]}
            last7={[48, 62, null, 30, 71, 55, null].map((score, i) => ({ date: `2026-11-${String(7 + i).padStart(2, "0")}`, score }))}
          />
        )}
      </main>
    </>
  );
}
