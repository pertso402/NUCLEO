import { HabitBoard } from "@/components/routine/HabitBoard";
import { RotinaTabs } from "@/components/routine/RotinaTabs";
import { TaskBoard } from "@/components/routine/TaskBoard";
import { TimePanel } from "@/components/routine/TimePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadHabits, loadTasks, loadTime, type RotinaTab } from "@/lib/data/routine";
import { formatLongDate, todayISO } from "@/lib/dates";

function tabOf(v: string | string[] | undefined): RotinaTab {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "habitos" || s === "tempo" ? s : "tarefas";
}

/** Rotina (ARCHITECTURE §7.5): Tarefas (Hoje · Semana · Backlog) · Hábitos (12 semanas) · Tempo. Só carrega a aba aberta. */
export default async function RotinaPage(props: PageProps<"/rotina">) {
  const tab = tabOf((await props.searchParams).aba);
  const now = new Date();
  const today = todayISO(now);

  let body: React.ReactNode;
  if (tab === "habitos") {
    const d = await loadHabits(today);
    body = <HabitBoard habits={d.habits} logs={d.logs} today={today} />;
  } else if (tab === "tempo") {
    body = <TimePanel data={await loadTime(today)} today={today} serverNow={now.toISOString()} />;
  } else {
    const d = await loadTasks(today);
    body = <TaskBoard open={d.open} doneToday={d.doneToday} today={today} />;
  }

  return (
    <>
      <PageHeader title="Rotina" kicker={formatLongDate(today)} />
      <RotinaTabs active={tab} />
      {body}
    </>
  );
}
