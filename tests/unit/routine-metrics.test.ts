import { describe, expect, it } from "vitest";
import {
  bucketTasks,
  entryMinutes,
  heatmapWeeks,
  isOverdue,
  lastDays,
  minutesByDay,
  minutesByLabel,
  type TaskLite,
  type TimeEntryLite,
} from "@/lib/metrics/routine";

const TODAY = "2026-11-13"; // sexta
const task = (p: Partial<TaskLite> & { id: string }): TaskLite => ({
  title: p.id,
  due_on: null,
  status: "todo",
  moves_revenue: false,
  priority: 2,
  completed_at: null,
  ...p,
});

describe("bucketTasks", () => {
  it("hoje = atrasadas + hoje; semana = até 7 dias; backlog = sem prazo ou depois", () => {
    const b = bucketTasks(
      [
        task({ id: "atrasada", due_on: "2026-11-10" }),
        task({ id: "hoje", due_on: TODAY }),
        task({ id: "amanha", due_on: "2026-11-14" }),
        task({ id: "dia20", due_on: "2026-11-20" }),
        task({ id: "dia21", due_on: "2026-11-21" }),
        task({ id: "semprazo" }),
        task({ id: "feita", due_on: TODAY, status: "done" }),
      ],
      TODAY,
    );
    expect(b.hoje.map((t) => t.id)).toEqual(["atrasada", "hoje"]);
    expect(b.semana.map((t) => t.id)).toEqual(["amanha", "dia20"]);
    expect(b.backlog.map((t) => t.id)).toEqual(["dia21", "semprazo"]);
  });

  it("faturamento primeiro, depois prazo, depois prioridade", () => {
    const b = bucketTasks(
      [
        task({ id: "c", due_on: TODAY, priority: 3 }),
        task({ id: "a", due_on: TODAY, priority: 1 }),
        task({ id: "$", due_on: TODAY, moves_revenue: true, priority: 3 }),
        task({ id: "velha", due_on: "2026-11-01", priority: 3 }),
      ],
      TODAY,
    );
    expect(b.hoje.map((t) => t.id)).toEqual(["$", "velha", "a", "c"]);
  });

  it("isOverdue só para aberta com prazo antes de hoje", () => {
    expect(isOverdue({ due_on: "2026-11-12", status: "todo" }, TODAY)).toBe(true);
    expect(isOverdue({ due_on: TODAY, status: "todo" }, TODAY)).toBe(false);
    expect(isOverdue({ due_on: "2026-11-12", status: "done" }, TODAY)).toBe(false);
    expect(isOverdue({ due_on: null, status: "todo" }, TODAY)).toBe(false);
  });
});

describe("heatmapWeeks", () => {
  it("12 colunas seg→dom terminando na semana de hoje, intensidade = feitos/ativos", () => {
    const g = heatmapWeeks(new Map([["2026-11-13", 2], ["2026-11-09", 4], ["2026-08-24", 1]]), TODAY, 4);
    expect(g).toHaveLength(12);
    expect(g[0]![0]!.date).toBe("2026-08-24"); // segunda, 11 semanas antes
    expect(g[0]![0]).toMatchObject({ count: 1, level: 0.25, future: false });
    const last = g[11]!;
    expect(last.map((c) => c.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(last[0]!.level).toBe(1);
    expect(last[4]).toMatchObject({ count: 2, level: 0.5, future: false });
    expect(last[5]!.future).toBe(true);
  });

  it("sem hábitos ativos: dia com marcação acende inteiro", () => {
    const g = heatmapWeeks(new Map([[TODAY, 1]]), TODAY, 0);
    expect(g[11]![4]!.level).toBe(1);
  });

  it("lastDays", () => {
    expect(lastDays(TODAY, 3)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13"]);
  });
});

describe("tempo", () => {
  const NOW = new Date("2026-11-13T15:00:00Z"); // 12h SP
  const e = (p: Partial<TimeEntryLite> & { id: string; started_at: string }): TimeEntryLite => ({
    label: null,
    ended_at: null,
    is_focus: true,
    ...p,
  });
  const entries = [
    e({ id: "1", label: "site", started_at: "2026-11-13T12:00:00Z", ended_at: "2026-11-13T13:30:00Z" }), // 90 hoje
    e({ id: "2", label: "Site", started_at: "2026-11-13T14:30:00Z" }), // aberto: 30 hoje
    e({ id: "3", label: "prospecção", started_at: "2026-11-12T02:30:00Z", ended_at: "2026-11-12T03:00:00Z" }), // 11/11 23h30 SP
    e({ id: "4", started_at: "2026-11-12T12:00:00Z", ended_at: "2026-11-12T12:45:00Z" }), // 45 ontem, sem rótulo
    e({ id: "5", label: "pausa", started_at: "2026-11-13T11:00:00Z", ended_at: "2026-11-13T11:20:00Z", is_focus: false }),
  ];

  it("minutos de uma entrada (aberta conta até agora)", () => {
    expect(entryMinutes(entries[0]!, NOW)).toBe(90);
    expect(entryMinutes(entries[1]!, NOW)).toBe(30);
  });

  it("por dia usa o dia de São Paulo e ignora o que não é foco", () => {
    expect(minutesByDay(entries, TODAY, NOW, 3)).toEqual([
      { date: "2026-11-11", minutes: 30 },
      { date: "2026-11-12", minutes: 45 },
      { date: "2026-11-13", minutes: 120 },
    ]);
  });

  it("por rótulo: ignora maiúsculas, sem rótulo vira 'Sem rótulo', maior primeiro", () => {
    expect(minutesByLabel(entries, "2026-11-12", TODAY, NOW)).toEqual([
      { label: "site", minutes: 120 },
      { label: "Sem rótulo", minutes: 45 },
      { label: "pausa", minutes: 20 },
    ]);
  });
});
