import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { HabitBoard } from "@/components/routine/HabitBoard";
import { RotinaTabs } from "@/components/routine/RotinaTabs";
import { TaskBoard } from "@/components/routine/TaskBoard";
import { TimePanel } from "@/components/routine/TimePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Habit, Task } from "@/lib/data/routine";
import { addDays, formatLongDate } from "@/lib/dates";
import type { TimeEntryLite } from "@/lib/metrics/routine";

/**
 * Vitrine de desenvolvimento da Rotina com dados fictícios (404 em produção).
 * `?aba=habitos|tempo`, `&vazio=1` para os estados vazios. Não use os botões de salvar aqui: eles falam com o banco de verdade.
 */
const TODAY = "2026-11-13";
const NOW = "2026-11-13T15:00:00.000Z";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const task = (n: number, p: Partial<Task>): Task => ({
  id: id(n),
  title: "",
  notes: null,
  due_on: null,
  status: "todo",
  moves_revenue: false,
  priority: 2,
  completed_at: null,
  goal_id: null,
  ...p,
});

const TASKS: Task[] = [
  task(1, { title: "Mandar proposta pra Sorveteria Gelato", due_on: TODAY, moves_revenue: true }),
  task(2, { title: "Cobrar parcela do Choppatinhas", due_on: "2026-11-11", moves_revenue: true }),
  task(3, { title: "Renovar a CNH", due_on: TODAY }),
  task(4, { title: "Follow-up Mercado Bom Preço", due_on: "2026-11-16", moves_revenue: true }),
  task(5, { title: "Ligar pro contador", due_on: "2026-11-14" }),
  task(6, { title: "Atualizar portfólio com os cardápios novos" }),
  task(7, { title: "Estudar Meta Ads avançado" }),
];
const DONE = [task(8, { title: "Reunião com a Pizzaria Forno", status: "done", completed_at: NOW, moves_revenue: true })];

const HABITS: Habit[] = [
  { id: id(11), name: "Academia", target_per_week: 5, position: 0, unit: "week", current_streak: 3, best_streak: 3 },
  { id: id(12), name: "Leitura", target_per_week: 7, position: 1, unit: "day", current_streak: 6, best_streak: 14 },
  { id: id(13), name: "Meditação", target_per_week: 7, position: 2, unit: "day", current_streak: 0, best_streak: 4 },
];

/** Logs fictícios determinísticos para 12 semanas. */
function fakeLogs(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (let i = 0; i < 84; i++) {
    const d = addDays(TODAY, -i);
    if ((i * 7) % 10 < 7 && i % 7 !== 1) (out[id(11)] ??= []).push(d);
    if (i < 6 || (i > 8 && i % 3 !== 0)) (out[id(12)] ??= []).push(d);
    if (i > 2 && i % 4 === 0) (out[id(13)] ??= []).push(d);
  }
  return out;
}

const at = (iso: string) => new Date(iso).toISOString();
const ENTRIES: TimeEntryLite[] = [
  { id: id(21), label: "cardápio Choppatinhas", started_at: at("2026-11-13T14:18:00Z"), ended_at: null, is_focus: true },
  { id: id(22), label: "prospecção", started_at: at("2026-11-13T11:30:00Z"), ended_at: at("2026-11-13T13:05:00Z"), is_focus: true },
  { id: id(23), label: "site da padaria", started_at: at("2026-11-12T12:00:00Z"), ended_at: at("2026-11-12T16:10:00Z"), is_focus: true },
  { id: id(24), label: "prospecção", started_at: at("2026-11-11T12:00:00Z"), ended_at: at("2026-11-11T14:00:00Z"), is_focus: true },
  { id: id(25), label: "cardápio Choppatinhas", started_at: at("2026-11-10T13:00:00Z"), ended_at: at("2026-11-10T17:30:00Z"), is_focus: true },
  { id: id(26), label: "site da padaria", started_at: at("2026-11-09T12:00:00Z"), ended_at: at("2026-11-09T13:00:00Z"), is_focus: true },
  { id: id(27), label: "estudo", started_at: at("2026-11-08T13:00:00Z"), ended_at: at("2026-11-08T14:30:00Z"), is_focus: true },
];

export default async function DevRotinaPage(props: PageProps<"/dev/rotina">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const tab = sp.aba === "habitos" || sp.aba === "tempo" ? sp.aba : "tarefas";
  const empty = sp.vazio === "1";

  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <PageHeader title="Rotina" kicker={formatLongDate(TODAY)} />
        <RotinaTabs active={tab} base="/dev/rotina" />
        {tab === "tarefas" && <TaskBoard open={empty ? [] : TASKS} doneToday={empty ? [] : DONE} today={TODAY} />}
        {tab === "habitos" && <HabitBoard habits={empty ? [] : HABITS} logs={empty ? {} : fakeLogs()} today={TODAY} />}
        {tab === "tempo" && (
          <TimePanel
            data={{
              entries: empty ? [] : ENTRIES,
              openTimer: empty ? null : ENTRIES[0]!,
              focusGoalMinutes: 240,
            }}
            today={TODAY}
            serverNow={NOW}
          />
        )}
      </main>
    </>
  );
}
