import "server-only";
import type { GoalArea, GoalStatus } from "@/lib/metrics/goals";
import { createClient } from "@/lib/supabase/server";

export interface GoalTask {
  id: string;
  title: string;
  due_on: string | null;
  status: "todo" | "done";
  moves_revenue: boolean;
}

export interface Goal {
  id: string;
  title: string;
  area: GoalArea;
  why: string | null;
  quarter: string;
  target_date: string | null;
  status: GoalStatus;
  metric_label: string | null;
  metric_target: number | null;
  metric_current: number | null;
  position: number;
  tasks: GoalTask[];
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Objetivos de um trimestre com as tarefas vinculadas (abertas e feitas; descartadas ficam de fora). */
export async function loadGoals(quarter: string): Promise<Goal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, area, why, quarter, target_date, status, metric_label, metric_target, metric_current, position")
    .eq("quarter", quarter)
    .order("position")
    .order("created_at");
  if (error) throw new Error(`Falha ao ler objetivos: ${error.message}`);
  const goals = data ?? [];
  const ids = goals.map((g) => g.id as string);

  const byGoal = new Map<string, GoalTask[]>();
  if (ids.length) {
    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, due_on, status, moves_revenue, goal_id")
      .in("goal_id", ids)
      .in("status", ["todo", "done"])
      .order("status", { ascending: false }) // todo antes de done
      .order("due_on", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (tErr) throw new Error(`Falha ao ler tarefas dos objetivos: ${tErr.message}`);
    for (const t of tasks ?? []) {
      const list = byGoal.get(t.goal_id as string) ?? [];
      list.push({
        id: t.id as string,
        title: t.title as string,
        due_on: (t.due_on as string | null) ?? null,
        status: t.status as "todo" | "done",
        moves_revenue: Boolean(t.moves_revenue),
      });
      byGoal.set(t.goal_id as string, list);
    }
  }

  return goals.map((g) => ({
    id: g.id as string,
    title: g.title as string,
    area: g.area as GoalArea,
    why: (g.why as string | null) ?? null,
    quarter: g.quarter as string,
    target_date: (g.target_date as string | null) ?? null,
    status: g.status as GoalStatus,
    metric_label: (g.metric_label as string | null) ?? null,
    metric_target: num(g.metric_target),
    metric_current: num(g.metric_current),
    position: Number(g.position),
    tasks: byGoal.get(g.id as string) ?? [],
  }));
}
