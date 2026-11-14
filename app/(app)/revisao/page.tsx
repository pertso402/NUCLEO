import { DailyReview } from "@/components/review/DailyReview";
import { ReviewTabs } from "@/components/review/ReviewTabs";
import { WeekReview } from "@/components/review/WeekReview";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadDailyReviewData, loadWeeklyReviewData } from "@/lib/data/review";
import { loadToday } from "@/lib/data/today";
import { formatLongDate, todayISO } from "@/lib/dates";
import { defaultReviewWeek, isCurrentWeek, isMonday } from "@/lib/metrics/week";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Revisão (ARCHITECTURE §7.7): fechamento do dia em 60s e revisão semanal. */
export default async function RevisaoPage(props: PageProps<"/revisao">) {
  const sp = await props.searchParams;
  const now = new Date();
  const today = todayISO(now);
  const tab = one(sp.aba) === "semana" ? "semana" : "hoje";

  if (tab === "semana") {
    const s = one(sp.semana);
    const weekStart = s && isMonday(s) ? s : defaultReviewWeek(today);
    const data = await loadWeeklyReviewData(weekStart, now);
    return (
      <>
        <PageHeader title="Revisão" kicker="Semana" />
        <ReviewTabs active="semana" />
        <WeekReview
          key={weekStart}
          weekStart={weekStart}
          numbers={data.numbers}
          previous={data.previous}
          review={data.review}
          current={isCurrentWeek(weekStart, now)}
        />
      </>
    );
  }

  const [day, data] = await Promise.all([loadToday(now), loadDailyReviewData(today)]);
  return (
    <>
      <PageHeader title="Revisão" kicker={formatLongDate(today)} />
      <ReviewTabs active="hoje" />
      <DailyReview day={day} saved={data.todayReview} yesterdayTop3={data.yesterdayTop3} last7={data.last7} />
    </>
  );
}
