import { describe, expect, it, vi } from "vitest";

// O executor importa o módulo de marcos (consulta views); aqui só interessa a rotina.
vi.mock("@/lib/data/milestone", () => ({
  loadHighlightMilestone: vi.fn(async () => null),
  syncAchievements: vi.fn(async () => []),
}));

import { composeReply, executeCalls, type ExecContext, type RoutineState } from "@/lib/ingest/executor";
import { matchByName } from "@/lib/ingest/match";
import { buildSystemPrompt } from "@/lib/ingest/parser";
import { dayLabel, formatDuration } from "@/lib/ingest/routine";
import { ToolCallSchema, type ToolCall } from "@/lib/ingest/tools";
import { fakeSupabase } from "./helpers/fake-supabase";

const U = "user-1";
const NOW = new Date("2026-11-13T15:00:00Z"); // sexta 13/11, 12h em SP

function setup(opts: { routine?: Partial<RoutineState>; seed?: Record<string, Record<string, unknown>[]> } = {}) {
  const db = fakeSupabase(
    opts.seed ?? {},
    { habit_logs: ["habit_id", "log_date"] },
    { tasks: { status: "todo", completed_at: null }, time_entries: { ended_at: null, is_focus: true } },
  );
  const routine: RoutineState = { habits: [], openTasks: [], goals: [], openTimer: null, ...opts.routine };
  const ctx: ExecContext = {
    supabase: db.client,
    userId: U,
    inboxId: "inbox-now",
    source: "whatsapp",
    now: NOW,
    categories: [],
    routine,
  };
  return { db, ctx, run: (calls: ToolCall[]) => executeCalls(calls, ctx) };
}

describe("matchByName", () => {
  const items = ["Academia", "Leitura", "Mandar proposta pra Sorveteria Gelato", "Mandar proposta pro Mercado Bom Preço"];
  const m = (ref: string) => matchByName(items, ref, (s) => s);

  it("igual sem acento/caixa, e por trecho", () => {
    expect(m("academia")).toEqual({ item: "Academia" });
    expect(m("LEITURA")).toEqual({ item: "Leitura" });
    expect(m("sorveteria gelato")).toEqual({ item: "Mandar proposta pra Sorveteria Gelato" });
  });
  it("palavras em comum, inclusive plural", () => {
    expect(m("proposta da gelato")).toEqual({ item: "Mandar proposta pra Sorveteria Gelato" });
    expect(m("academias")).toEqual({ item: "Academia" });
  });
  it("empate vira ambíguo; nada parecido vira null", () => {
    expect(m("mandar proposta")).toEqual({ ambiguous: [items[2], items[3]] });
    expect(m("meditação")).toBeNull();
    expect(m("   ")).toBeNull();
  });
});

describe("formatação", () => {
  it("duração", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(85)).toBe("1h25");
    expect(formatDuration(125)).toBe("2h05");
  });
  it("dia relativo", () => {
    expect(dayLabel("2026-11-13", "2026-11-13")).toBe("hoje");
    expect(dayLabel("2026-11-14", "2026-11-13")).toBe("amanhã");
    expect(dayLabel("2026-11-12", "2026-11-13")).toBe("ontem");
    expect(dayLabel("2026-11-20", "2026-11-13")).toBe("sex 20/11");
  });
});

describe("tarefas", () => {
  it("cria com prazo, faturamento e objetivo; prazo no passado vira hoje", async () => {
    const { db, run } = setup({ routine: { goals: [{ id: "g1", title: "Chegar a R$ 10k/mês" }] } });
    const [a, b] = await run([
      { name: "add_task", args: { title: "Mandar proposta pra Gelato", due_on: "2026-11-20", moves_revenue: true, goal_ref: "10k" } },
      { name: "add_task", args: { title: "Pagar boleto", due_on: "2026-11-01", moves_revenue: false, goal_ref: null } },
    ]);
    expect(a!.line).toBe("✅ Tarefa: Mandar proposta pra Gelato · sex 20/11 · mexe no faturamento");
    expect(b!.line).toBe("✅ Tarefa: Pagar boleto · hoje");
    expect(db.tables.tasks).toMatchObject([
      { user_id: U, due_on: "2026-11-20", moves_revenue: true, goal_id: "g1", source: "whatsapp" },
      { due_on: "2026-11-13", goal_id: null },
    ]);
  });

  it("conclui a tarefa certa e guarda o estado anterior para o desfaz", async () => {
    const seed = { tasks: [{ id: "t1", user_id: U, title: "Mandar proposta pra Gelato", status: "todo", completed_at: null }] };
    const { db, ctx, run } = setup({
      seed,
      routine: { openTasks: [{ id: "t1", title: "Mandar proposta pra Gelato", due_on: null, moves_revenue: true }] },
    });
    const [o] = await run([{ name: "complete_task", args: { task_ref: "proposta da gelato" } }]);
    expect(o).toMatchObject({
      ok: true,
      line: "✅ Feita: Mandar proposta pra Gelato · mexeu no faturamento",
      updated: [{ table: "tasks", id: "t1", before: { status: "todo", completed_at: null } }],
    });
    expect(db.tables.tasks![0]).toMatchObject({ status: "done", completed_at: NOW.toISOString() });
    expect(ctx.routine.openTasks).toEqual([]);
  });

  it("criar e concluir na mesma mensagem funciona", async () => {
    const { db, run } = setup();
    await run([
      { name: "add_task", args: { title: "Ligar pro contador", due_on: null, moves_revenue: false, goal_ref: null } },
      { name: "complete_task", args: { task_ref: "contador" } },
    ]);
    expect(db.tables.tasks![0]).toMatchObject({ status: "done" });
  });

  it("não achou ou ficou ambíguo: pergunta, não altera nada", async () => {
    const open = [
      { id: "t1", title: "Proposta Gelato", due_on: null, moves_revenue: true },
      { id: "t2", title: "Proposta Bom Preço", due_on: null, moves_revenue: true },
    ];
    const { db, run } = setup({ routine: { openTasks: open } });
    const [a, b] = await run([
      { name: "complete_task", args: { task_ref: "site da padaria" } },
      { name: "complete_task", args: { task_ref: "proposta" } },
    ]);
    expect(a).toMatchObject({ ok: false, clarification: true });
    expect(a!.line).toContain('Não achei a tarefa "site da padaria"');
    expect(b!.line).toBe('❓ Qual delas? "Proposta Gelato", "Proposta Bom Preço"');
    expect(db.log).toEqual([]);
  });
});

describe("hábitos", () => {
  const habits = [
    { id: "h1", name: "Academia" },
    { id: "h2", name: "Leitura" },
  ];

  it("marca hoje e mostra a sequência", async () => {
    const { db, run } = setup({
      routine: { habits },
      seed: { v_habit_streaks: [{ habit_id: "h1", user_id: U, unit: "day", current_streak: 4 }] },
    });
    const [a, b] = await run([
      { name: "log_habit", args: { habit_ref: "academia", date: null } },
      { name: "log_habit", args: { habit_ref: "Leitura", date: "2026-11-12" } },
    ]);
    expect(a!.line).toBe("✅ Hábito: Academia · 4 dias seguidos");
    expect(b!.line).toBe("✅ Hábito: Leitura ontem");
    expect(db.tables.habit_logs).toMatchObject([
      { user_id: U, habit_id: "h1", log_date: "2026-11-13" },
      { habit_id: "h2", log_date: "2026-11-12" },
    ]);
  });

  it("sequência semanal e data futura (vira hoje)", async () => {
    const { db, run } = setup({
      routine: { habits },
      seed: { v_habit_streaks: [{ habit_id: "h2", user_id: U, unit: "week", current_streak: 3 }] },
    });
    const [o] = await run([{ name: "log_habit", args: { habit_ref: "leitura", date: "2026-11-20" } }]);
    expect(o!.line).toBe("✅ Hábito: Leitura · 3 semanas seguidas na meta");
    expect(db.tables.habit_logs![0]!.log_date).toBe("2026-11-13");
  });

  it("já marcado no dia: avisa sem erro e sem nada pra desfazer", async () => {
    const { run } = setup({
      routine: { habits },
      seed: { habit_logs: [{ id: "l1", user_id: U, habit_id: "h1", log_date: "2026-11-13" }] },
    });
    const [o] = await run([{ name: "log_habit", args: { habit_ref: "Academia", date: null } }]);
    expect(o).toMatchObject({ ok: true, line: "✅ Academia hoje já estava marcado." });
    expect(o!.created).toBeUndefined();
  });

  it("hábito desconhecido ou nenhum cadastrado: pergunta", async () => {
    const semHabitos = setup();
    expect((await semHabitos.run([{ name: "log_habit", args: { habit_ref: "yoga", date: null } }]))[0]!.line).toContain(
      "ainda não tem hábitos",
    );
    const comHabitos = setup({ routine: { habits } });
    expect((await comHabitos.run([{ name: "log_habit", args: { habit_ref: "yoga", date: null } }]))[0]!.line).toBe(
      '❓ Não achei o hábito "yoga". Hábitos: "Academia", "Leitura".',
    );
  });
});

describe("tempo", () => {
  it("inicia timer; iniciar outro fecha o anterior (e guarda pra desfazer)", async () => {
    const started = new Date(NOW.getTime() - 25 * 60_000).toISOString();
    const { db, ctx, run } = setup({
      seed: { time_entries: [{ id: "e1", user_id: U, label: "site", started_at: started, ended_at: null, is_focus: true }] },
      routine: { openTimer: { id: "e1", label: "site", started_at: started } },
    });
    const [o] = await run([{ name: "start_timer", args: { label: "cardápio Choppatinhas" } }]);
    expect(o!.line).toBe("✅ Timer parado: site · 25 min\n✅ Timer iniciado: cardápio Choppatinhas");
    expect(o!.updated).toEqual([{ table: "time_entries", id: "e1", before: { ended_at: null } }]);
    expect(db.tables.time_entries![0]!.ended_at).toBe(NOW.toISOString());
    expect(db.tables.time_entries![1]).toMatchObject({ label: "cardápio Choppatinhas", ended_at: null });
    expect(ctx.routine.openTimer?.label).toBe("cardápio Choppatinhas");
  });

  it("para o timer e soma o foco do dia", async () => {
    const started = new Date(NOW.getTime() - 85 * 60_000).toISOString();
    const { run } = setup({
      seed: {
        time_entries: [
          { id: "e0", user_id: U, label: "manhã", started_at: "2026-11-13T12:00:00.000Z", ended_at: "2026-11-13T12:30:00.000Z", is_focus: true },
          { id: "e1", user_id: U, label: "site", started_at: started, ended_at: null, is_focus: true },
        ],
      },
      routine: { openTimer: { id: "e1", label: "site", started_at: started } },
    });
    const [o] = await run([{ name: "stop_timer", args: {} }]);
    expect(o!.line).toBe("✅ Timer parado: site · 1h25 · hoje: 1h55 de foco");
  });

  it("parar sem timer aberto", async () => {
    const { run } = setup();
    expect((await run([{ name: "stop_timer", args: {} }]))[0]).toMatchObject({ ok: false, line: "Nenhum timer rodando." });
  });

  it("registra tempo de hoje (termina agora) e de ontem (termina 18h)", async () => {
    const { db, run } = setup();
    const [a, b] = await run([
      { name: "log_time", args: { minutes: 90, label: "site da padaria", date: null } },
      { name: "log_time", args: { minutes: 45, label: "prospecção", date: "2026-11-12" } },
    ]);
    expect(a!.line).toBe("✅ Tempo: 1h30 · site da padaria");
    expect(b!.line).toBe("✅ Tempo: 45 min · prospecção · ontem");
    expect(db.tables.time_entries).toMatchObject([
      { started_at: "2026-11-13T13:30:00.000Z", ended_at: "2026-11-13T15:00:00.000Z" },
      { started_at: "2026-11-12T20:15:00.000Z", ended_at: "2026-11-12T21:00:00.000Z" }, // 18h SP = 21h UTC
    ]);
  });
});

describe("desfaz da rotina", () => {
  it("apaga o que criou e restaura o que alterou (timer novo sai antes de reabrir o anterior)", async () => {
    const seed = {
      inbox_messages: [
        {
          id: "inbox-1",
          user_id: U,
          status: "ok",
          result: {
            created: [{ table: "time_entries", id: "e2" }],
            updated: [{ table: "time_entries", id: "e1", before: { ended_at: null } }],
            lines: ["✅ Timer parado: site · 25 min\n✅ Timer iniciado: cardápio"],
          },
        },
      ],
      time_entries: [
        { id: "e1", user_id: U, ended_at: "2026-11-13T15:00:00.000Z" },
        { id: "e2", user_id: U, ended_at: null },
      ],
    };
    const { db, run } = setup({ seed });
    const [o] = await run([{ name: "undo_last", args: {} }]);
    expect(o!.line).toBe("↩️ Desfeito: Timer parado: site · 25 min; Timer iniciado: cardápio");
    expect(db.tables.time_entries).toEqual([{ id: "e1", user_id: U, ended_at: null }]);
    expect(db.tables.inbox_messages![0]!.status).toBe("undone");
    const ops = db.log.map((l) => `${l.table}:${l.op}`);
    expect(ops.indexOf("time_entries:delete")).toBeLessThan(ops.indexOf("time_entries:update"));
  });

  it("desfaz tarefa concluída e hábito marcado", async () => {
    const seed = {
      inbox_messages: [
        {
          id: "inbox-1",
          user_id: U,
          status: "ok",
          result: {
            created: [{ table: "habit_logs", id: "l1" }],
            updated: [{ table: "tasks", id: "t1", before: { status: "todo", completed_at: null } }],
            lines: [],
          },
        },
      ],
      tasks: [{ id: "t1", user_id: U, status: "done", completed_at: "2026-11-13T15:00:00.000Z" }],
      habit_logs: [{ id: "l1", user_id: U }],
    };
    const { db, run } = setup({ seed });
    await run([{ name: "undo_last", args: {} }]);
    expect(db.tables.tasks![0]).toMatchObject({ status: "todo", completed_at: null });
    expect(db.tables.habit_logs).toEqual([]);
  });
});

describe("resposta", () => {
  it("rotina tem dica do desfaz; aviso sem alteração não tem", async () => {
    const { ctx } = setup();
    expect(await composeReply([{ tool: "complete_task", ok: true, line: "✅ Feita: x", updated: [{ table: "tasks", id: "t", before: {} }] }], ctx)).toBe(
      '✅ Feita: x\n↩️ "desfaz" pra reverter',
    );
    expect(await composeReply([{ tool: "stop_timer", ok: false, line: "Nenhum timer rodando." }], ctx)).toBe("Nenhum timer rodando.");
  });
});

describe("parser: prompt e esquema da rotina", () => {
  it("leva hábitos, tarefas, objetivos, timer e o calendário da semana", () => {
    const p = buildSystemPrompt({
      now: NOW,
      incomeCategories: [],
      expenseCategories: [],
      habits: ["Academia", "Leitura"],
      openTasks: ["Mandar proposta pra Gelato"],
      goals: ["R$ 10k/mês"],
      openTimer: { label: "site", minutes: 12 },
    });
    expect(p).toContain('Hábitos ativos: "Academia", "Leitura".');
    expect(p).toContain('Tarefas abertas: "Mandar proposta pra Gelato".');
    expect(p).toContain('Objetivos ativos: "R$ 10k/mês".');
    expect(p).toContain('Timer: rodando há 12 min ("site").');
    expect(p).toContain("Ontem = 2026-11-12.");
    expect(p).toContain("sábado 14/11 = 2026-11-14");
    expect(p).toContain("sexta 20/11 = 2026-11-20");
  });

  it("sem rotina cadastrada, o prompt diz isso", () => {
    const p = buildSystemPrompt({ now: NOW, incomeCategories: [], expenseCategories: [] });
    expect(p).toContain("Hábitos ativos: nenhum cadastrado.");
    expect(p).toContain("Timer: nenhum.");
  });

  it("valida as ferramentas novas", () => {
    const ok = (c: unknown) => ToolCallSchema.safeParse(c).success;
    expect(ok({ name: "add_task", args: { title: "x", due_on: "2026-11-20", moves_revenue: true, goal_ref: null } })).toBe(true);
    expect(ok({ name: "add_task", args: { title: " ", due_on: null, moves_revenue: false, goal_ref: null } })).toBe(false);
    expect(ok({ name: "log_habit", args: { habit_ref: "Academia", date: "ontem" } })).toBe(false);
    expect(ok({ name: "log_time", args: { minutes: 90, label: "site", date: null } })).toBe(true);
    expect(ok({ name: "log_time", args: { minutes: 1.5, label: "site", date: null } })).toBe(false);
    expect(ok({ name: "log_time", args: { minutes: 0, label: "site", date: null } })).toBe(false);
    expect(ok({ name: "stop_timer", args: {} })).toBe(true);
  });
});
