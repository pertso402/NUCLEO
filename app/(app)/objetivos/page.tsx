import { GoalsView } from "@/components/goals/GoalsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadGoals } from "@/lib/data/goals";
import { todayISO } from "@/lib/dates";
import { isQuarter, quarterOf } from "@/lib/metrics/goals";

export default async function ObjetivosPage(props: PageProps<"/objetivos">) {
  const sp = await props.searchParams;
  const today = todayISO();
  const current = quarterOf(today);
  const tri = Array.isArray(sp.tri) ? sp.tri[0] : sp.tri;
  const quarter = isQuarter(tri) ? tri : current;

  return (
    <>
      <PageHeader title="Objetivos" kicker="Plano do trimestre" />
      <GoalsView goals={await loadGoals(quarter)} quarter={quarter} currentQuarter={current} today={today} />
    </>
  );
}
