import { notFound } from "next/navigation";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectTime } from "@/components/projects/ProjectTime";
import { TaskBoard } from "@/components/routine/TaskBoard";
import { loadProjects, loadProjectStats, loadTimeEntries, loadWorkTasks } from "@/lib/data/productivity";
import { todayISO } from "@/lib/dates";

/** Projeto (Fase P): números, horas por semana e as tarefas só dele. */
export default async function ProjectPage(props: PageProps<"/rotina/projeto/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const now = new Date();
  const today = todayISO(now);
  const [all, stats, tasks, entries] = await Promise.all([loadProjects(true), loadProjectStats(now), loadWorkTasks(now), loadTimeEntries(now)]);
  const project = all.find((p) => p.id === id);
  if (!project) notFound();
  const s = stats.find((p) => p.id === id) ?? { minutesWeek: 0, minutesMonth: 0, minutesTotal: 0, openTasks: 0, doneTasks: 0 };

  return (
    <>
      <ProjectHeader project={project} />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <ProjectTime
          entries={entries.filter((e) => e.project_id === id)}
          today={today}
          serverNow={now.toISOString()}
          weeklyGoalHours={project.weekly_hours_goal}
          stats={s}
        />
        <section aria-label="Tarefas do projeto">
          <h2 className="label-instrument mb-3">Tarefas</h2>
          <TaskBoard
            open={tasks.open.filter((t) => t.project_id === id)}
            doneToday={tasks.doneToday.filter((t) => t.project_id === id)}
            today={today}
            projects={all}
            projectId={id}
          />
        </section>
      </div>
    </>
  );
}
