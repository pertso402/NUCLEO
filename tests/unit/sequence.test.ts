import { describe, expect, it } from "vitest";
import { bucketTasks } from "@/lib/metrics/routine";
import { doNow, moveInSequence, orderAreaTasks, sequenceStates, sortByPriority, type SeqArea, type SeqTask } from "@/lib/metrics/sequence";

const t = (id: string, p: Partial<SeqTask> = {}): SeqTask => ({
  id,
  title: id,
  status: "todo",
  priority: 2,
  project_id: "p1",
  area_id: "mk",
  sequence: null,
  due_on: null,
  ...p,
});

const AREAS: SeqArea[] = [
  { id: "mk", project_id: "p1", name: "Marketing", priority: 1, sequential: true, position: 0 },
  { id: "co", project_id: "p1", name: "Comercial", priority: 0, sequential: true, position: 1 },
  { id: "op", project_id: "p1", name: "Operação", priority: 2, sequential: false, position: 2 },
  { id: "x", project_id: "p2", name: "Outro", priority: 2, sequential: true, position: 0 },
];
const PROJECTS = [
  { id: "p1", priority: 0, position: 0 },
  { id: "p2", priority: 3, position: 1 },
];

describe("sequência", () => {
  it("ordena pela posição; sem posição vai pro fim", () => {
    const list = [t("c", { sequence: 2 }), t("a", { sequence: 0 }), t("z"), t("b", { sequence: 1 })];
    expect(orderAreaTasks(list, true).map((x) => x.id)).toEqual(["a", "b", "c", "z"]);
  });

  it("sem sequência: fazendo, depois prioridade, depois prazo", () => {
    const list = [t("baixa", { priority: 3 }), t("prazo", { due_on: "2026-11-20" }), t("doing", { status: "doing", priority: 3 }), t("agora", { priority: 0 })];
    expect(orderAreaTasks(list, false).map((x) => x.id)).toEqual(["doing", "agora", "prazo", "baixa"]);
  });

  it("primeira aberta é a próxima; as outras ficam na fila; feitas não contam", () => {
    const list = [t("a", { sequence: 0, status: "done" }), t("b", { sequence: 1 }), t("c", { sequence: 2 })];
    const st = sequenceStates(list, true);
    expect(st.get("a")).toBeUndefined();
    expect(st.get("b")).toEqual({ state: "next", step: 1 });
    expect(st.get("c")).toEqual({ state: "queued", step: 2 });
    expect(sequenceStates(list, false).get("c")?.state).toBe("free");
  });

  it("subir/descer troca de lugar e não passa das pontas", () => {
    expect(moveInSequence(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveInSequence(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveInSequence(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });
});

describe("fazer agora", () => {
  it("Agora > fazendo > próxima de cada sequência; departamento urgente antes; projeto fora da lista some", () => {
    const tasks = [
      t("mk1", { area_id: "mk", sequence: 0 }),
      t("mk2", { area_id: "mk", sequence: 1 }),
      t("co1", { area_id: "co", sequence: 0 }),
      t("co2", { area_id: "co", sequence: 1, priority: 0 }),
      t("op-alta", { area_id: "op", priority: 1 }),
      t("op-media", { area_id: "op" }),
      t("doing", { area_id: null, status: "doing" }),
      t("pausado", { project_id: "p9", area_id: null, priority: 0 }),
    ];
    const ids = doNow(tasks, AREAS, PROJECTS).map((x) => `${x.task.id}:${x.reason}`);
    expect(ids).toEqual(["co2:agora", "doing:fazendo", "co1:proxima", "mk1:proxima", "op-alta:proxima"]);
  });

  it("projeto de prioridade maior vem antes entre as próximas", () => {
    const tasks = [t("outro", { project_id: "p2", area_id: "x", sequence: 0 }), t("mk1", { area_id: "mk", sequence: 0 })];
    expect(doNow(tasks, AREAS, PROJECTS).map((x) => x.task.id)).toEqual(["mk1", "outro"]);
  });

  it("ordena projetos por prioridade e posição", () => {
    expect(sortByPriority([{ priority: 2, position: 0 }, { priority: 0, position: 3 }, { priority: 2, position: -1 }])).toEqual([
      { priority: 0, position: 3 },
      { priority: 2, position: -1 },
      { priority: 2, position: 0 },
    ]);
  });

  it("tarefa Agora entra em Hoje mesmo sem prazo e vem primeiro", () => {
    const b = bucketTasks(
      [
        { id: "1", title: "receita", due_on: "2026-11-19", status: "todo", moves_revenue: true, priority: 2, completed_at: null },
        { id: "2", title: "agora", due_on: null, status: "todo", moves_revenue: false, priority: 0, completed_at: null },
      ],
      "2026-11-19",
    );
    expect(b.hoje.map((x) => x.id)).toEqual(["2", "1"]);
    expect(b.backlog).toEqual([]);
  });
});
