import { notFound } from "next/navigation";
import { FocusPanel } from "@/components/focus/FocusPanel";
import { FocusPill } from "@/components/focus/FocusPill";
import { FocusProvider } from "@/components/focus/FocusProvider";
import { GridBackground } from "@/components/hud/GridBackground";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { HabitBoard } from "@/components/routine/HabitBoard";
import { RotinaTabs } from "@/components/routine/RotinaTabs";
import { TaskBoard } from "@/components/routine/TaskBoard";
import { TimeAnalytics } from "@/components/time/TimeAnalytics";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OpenFocus, Project, ProjectStats, WorkTask } from "@/lib/data/productivity";
import type { Habit, RotinaTab } from "@/lib/data/routine";
import { addDays, formatLongDate, startOfDayInstant, todayISO } from "@/lib/dates";
import { DEFAULT_POMODORO } from "@/lib/metrics/pomodoro";
import { entryDay, entryMinutes, type TimeEntryRow } from "@/lib/metrics/time";

/**
 * Vitrine de desenvolvimento da Rotina com dados fictícios (404 em produção).
 * `?aba=projetos|foco|tempo|habitos`, `&vazio=1` para os estados vazios, `&foco=pomodoro|livre` para simular foco rodando.
 * Não use os botões de salvar aqui: eles falam com o banco de verdade.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PROJECTS: Project[] = [
  { id: id(101), name: "Choppatinhas", kind: "cliente", status: "active", color: "amber", description: "Cardápio digital + tráfego", lead_id: null, goal_id: null, weekly_hours_goal: 10, deadline: null, position: 0 },
  { id: id(102), name: "ARTe", kind: "negocio", status: "active", color: "violet", description: "Agência", lead_id: null, goal_id: null, weekly_hours_goal: 15, deadline: null, position: 1 },
  { id: id(103), name: "Padaria Pão Quente", kind: "cliente", status: "active", color: "cyan", description: null, lead_id: null, goal_id: null, weekly_hours_goal: 6, deadline: "2026-11-28", position: 2 },
  { id: id(104), name: "NÚCLEO", kind: "projeto", status: "active", color: "lime", description: "Meu Jarvis", lead_id: null, goal_id: null, weekly_hours_goal: null, deadline: null, position: 3 },
  { id: id(105), name: "Inglês", kind: "estudo", status: "paused", color: "pink", description: null, lead_id: null, goal_id: null, weekly_hours_goal: 3, deadline: null, position: 4 },
];

function fake(today: string) {
  const task = (n: number, p: Partial<WorkTask>): WorkTask => ({
    id: id(n),
    title: "",
    notes: null,
    due_on: null,
    status: "todo",
    moves_revenue: false,
    priority: 2,
    completed_at: null,
    goal_id: null,
    project_id: null,
    estimate_minutes: null,
    trackedMinutes: 0,
    ...p,
  });
  const tasks: WorkTask[] = [
    task(1, { title: "Montar cardápio de bebidas", due_on: today, project_id: id(101), status: "doing", estimate_minutes: 120, trackedMinutes: 75 }),
    task(2, { title: "Cobrar parcela de novembro", due_on: addDays(today, -2), moves_revenue: true, project_id: id(101) }),
    task(3, { title: "Proposta para Sorveteria Gelato", due_on: today, moves_revenue: true, project_id: id(102), estimate_minutes: 60 }),
    task(4, { title: "Roteiro dos reels da semana", due_on: addDays(today, 2), project_id: id(102), estimate_minutes: 90, trackedMinutes: 110 }),
    task(5, { title: "Fotos dos produtos novos", due_on: addDays(today, 3), project_id: id(103), estimate_minutes: 60 }),
    task(6, { title: "Tela de projetos no NÚCLEO", project_id: id(104), status: "doing", trackedMinutes: 140 }),
    task(7, { title: "Renovar a CNH", due_on: today }),
    task(8, { title: "Estudar Meta Ads avançado" }),
  ];
  const done = [task(9, { title: "Reunião com a Pizzaria Forno", status: "done", completed_at: new Date().toISOString(), project_id: id(102), trackedMinutes: 45 })];

  // ~6 meses de foco determinístico, com tendência de alta e projetos variando.
  const entries: TimeEntryRow[] = [];
  let n = 1000;
  const pids = [id(101), id(102), id(103), id(104), null];
  for (let i = 180; i >= 0; i--) {
    const d = addDays(today, -i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd === 0 && i % 3 !== 0) continue;
    const sessions = wd === 6 ? 1 : 2 + ((i * 7) % 3);
    for (let s = 0; s < sessions; s++) {
      const startH = [9, 11, 14, 16, 20][(i + s * 2) % 5]!;
      const minutes = Math.round((25 + ((i * 13 + s * 29) % 70)) * (1 + (180 - i) / 300));
      const start = new Date(startOfDayInstant(d).getTime() + startH * 3_600_000 + ((i * 11) % 40) * 60_000);
      const isPomo = (i + s) % 3 === 0;
      const end = new Date(start.getTime() + (isPomo ? 25 : minutes) * 60_000);
      if (i === 0 && end.getTime() > Date.now()) continue;
      entries.push({
        id: id(n++),
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        is_focus: true,
        project_id: pids[(i + s) % pids.length] ?? null,
        task_id: null,
        kind: isPomo ? "pomodoro" : (i + s) % 7 === 0 ? "manual" : "timer",
        label: ["cardápio", "prospecção", "site", "reels", "NÚCLEO dev"][(i * 3 + s) % 5]!,
        planned_minutes: isPomo ? 25 : null,
      });
    }
  }
  entries.reverse();

  const now = new Date();
  const week = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const stats: ProjectStats[] = PROJECTS.map((p, k) => {
    const mine = entries.filter((e) => e.project_id === p.id);
    const sum = (f: (e: TimeEntryRow) => boolean) => mine.filter(f).reduce((s, e) => s + entryMinutes(e, now), 0);
    return {
      ...p,
      openTasks: tasks.filter((t) => t.project_id === p.id).length,
      doneTasks: 3 + k * 2,
      minutesWeek: sum((e) => entryDay(e) >= week),
      minutesMonth: sum((e) => entryDay(e) >= `${today.slice(0, 7)}-01`),
      minutesTotal: sum(() => true),
      lastActivity: mine[0]?.started_at ?? null,
    };
  });
  return { tasks, done, entries, stats };
}

const HABITS: Habit[] = [
  { id: id(11), name: "Academia", target_per_week: 5, position: 0, unit: "week", current_streak: 3, best_streak: 3 },
  { id: id(12), name: "Leitura", target_per_week: 7, position: 1, unit: "day", current_streak: 6, best_streak: 14 },
];

export default async function DevRotinaPage(props: PageProps<"/dev/rotina">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const tabs: RotinaTab[] = ["tarefas", "projetos", "foco", "tempo", "habitos"];
  const tab = tabs.includes(sp.aba as RotinaTab) ? (sp.aba as RotinaTab) : "tarefas";
  const empty = sp.vazio === "1";
  const today = todayISO();
  const now = new Date();
  const d = fake(today);

  const open: OpenFocus | null =
    sp.foco === "pomodoro"
      ? { id: id(900), label: "Montar cardápio de bebidas", started_at: new Date(now.getTime() - 9 * 60_000).toISOString(), kind: "pomodoro", planned_minutes: 25, project_id: id(101), task_id: id(1) }
      : sp.foco === "livre"
        ? { id: id(901), label: "Tela de projetos no NÚCLEO", started_at: new Date(now.getTime() - 47 * 60_000).toISOString(), kind: "timer", planned_minutes: null, project_id: id(104), task_id: id(6) }
        : null;

  return (
    <FocusProvider
      state={{ open, config: DEFAULT_POMODORO, todayMinutes: empty ? 0 : 135, todayPomodoros: empty ? 0 : 2, focusGoalMinutes: 240, projects: empty ? [] : PROJECTS, serverNow: now.getTime() }}
    >
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <PageHeader title="Rotina" kicker={formatLongDate(today)} />
        <RotinaTabs active={tab} base="/dev/rotina" />
        {tab === "tarefas" && (
          <TaskBoard open={empty ? [] : d.tasks} doneToday={empty ? [] : d.done} today={today} projects={empty ? [] : PROJECTS} />
        )}
        {tab === "projetos" && <ProjectGrid projects={empty ? [] : d.stats} today={today} />}
        {tab === "foco" && <FocusPanel tasks={empty ? [] : d.tasks} focusGoalMinutes={240} />}
        {tab === "tempo" && (
          <TimeAnalytics entries={empty ? [] : d.entries} projects={PROJECTS} today={today} serverNow={now.toISOString()} focusGoalMinutes={240} />
        )}
        {tab === "habitos" && <HabitBoard habits={empty ? [] : HABITS} logs={{}} today={today} />}
      </main>
      <FocusPill />
    </FocusProvider>
  );
}
