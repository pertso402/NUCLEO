import { notFound } from "next/navigation";
import { AreaBoard } from "@/components/projects/AreaBoard";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectTime } from "@/components/projects/ProjectTime";
import { loadAreaProgress, loadAreas, loadProjects, loadProjectStats, loadTimeEntries, loadWorkTasks } from "@/lib/data/productivity";
import { todayISO } from "@/lib/dates";

/** Projeto (Fase P/P.8): departamentos com prioridade e sequência de tarefas, horas por semana e números. */
export default async function ProjectPage(props: PageProps<"/rotina/projeto/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const now = new Date();
  const today = todayISO(now);
  const [all, stats, tasks, entries, areas, progress] = await Promise.all([
    loadProjects(true),
    loadProjectStats(now),
    loadWorkTasks(now),
    loadTimeEntries(now),
    loadAreas(id),
    loadAreaProgress(id),
  ]);
  const project = all.find((p) => p.id === id);
  if (!project) notFound();
  const s = stats.find((p) => p.id === id) ?? { minutesWeek: 0, minutesMonth: 0, minutesTotal: 0, openTasks: 0, doneTasks: 0 };

  return (
    <>
      <ProjectHeader project={project} />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <section aria-label="Departamentos e tarefas" className="lg:order-2">
          <AreaBoard
            project={project}
            areas={areas}
            tasks={tasks.open.filter((t) => t.project_id === id)}
            progress={progress}
            allProjects={all.filter((p) => p.status !== "archived")}
          />
        </section>
        <div className="lg:order-1">
          <ProjectTime
            entries={entries.filter((e) => e.project_id === id)}
            today={today}
            serverNow={now.toISOString()}
            weeklyGoalHours={project.weekly_hours_goal}
            stats={s}
          />
        </div>
      </div>
    </>
  );
}
