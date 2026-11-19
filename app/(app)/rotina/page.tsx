import { FocusPanel } from "@/components/focus/FocusPanel";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { HabitBoard } from "@/components/routine/HabitBoard";
import { RotinaTabs } from "@/components/routine/RotinaTabs";
import { TaskBoard } from "@/components/routine/TaskBoard";
import { TimeAnalytics } from "@/components/time/TimeAnalytics";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadFocus, loadProjects, loadProjectStats, loadTimeEntries, loadWorkTasks } from "@/lib/data/productivity";
import { loadHabits, type RotinaTab } from "@/lib/data/routine";
import { formatLongDate, todayISO } from "@/lib/dates";

const TABS: RotinaTab[] = ["tarefas", "projetos", "foco", "tempo", "habitos"];
function tabOf(v: string | string[] | undefined): RotinaTab {
  const s = Array.isArray(v) ? v[0] : v;
  return TABS.includes(s as RotinaTab) ? (s as RotinaTab) : "tarefas";
}

/**
 * Rotina (Fase P): Tarefas por projeto · Projetos · Foco (pomodoro/cronômetro) · Tempo (análise) · Hábitos.
 * Só carrega a aba aberta.
 */
export default async function RotinaPage(props: PageProps<"/rotina">) {
  const tab = tabOf((await props.searchParams).aba);
  const now = new Date();
  const today = todayISO(now);

  let body: React.ReactNode;
  if (tab === "habitos") {
    const d = await loadHabits(today);
    body = <HabitBoard habits={d.habits} logs={d.logs} today={today} />;
  } else if (tab === "projetos") {
    body = <ProjectGrid projects={await loadProjectStats(now)} today={today} />;
  } else if (tab === "foco") {
    const [tasks, focus] = await Promise.all([loadWorkTasks(now), loadFocus(now)]);
    body = <FocusPanel tasks={tasks.open} focusGoalMinutes={focus.focusGoalMinutes} />;
  } else if (tab === "tempo") {
    const [entries, projects, focus] = await Promise.all([loadTimeEntries(now), loadProjects(true), loadFocus(now)]);
    body = (
      <TimeAnalytics entries={entries} projects={projects} today={today} serverNow={now.toISOString()} focusGoalMinutes={focus.focusGoalMinutes} />
    );
  } else {
    const [tasks, projects] = await Promise.all([loadWorkTasks(now), loadProjects()]);
    body = <TaskBoard open={tasks.open} doneToday={tasks.doneToday} today={today} projects={projects} />;
  }

  return (
    <>
      <PageHeader title="Rotina" kicker={formatLongDate(today)} />
      <RotinaTabs active={tab} />
      {body}
    </>
  );
}
