import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBRL } from "@/lib/money";
import { parseMessage } from "@/lib/ingest/parser";
import type { ToolCall } from "@/lib/ingest/tools";

// Carrega .env.local (local) se a chave não veio do ambiente.
const envFile = path.resolve(__dirname, "../../.env.local");
if (!process.env.OPENAI_API_KEY && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#") && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1);
  }
}

interface Expected {
  tool: ToolCall["name"];
  kind?: "income" | "expense";
  amount_cents?: number;
  category?: string;
  occurred_on?: string;
  counterparty_includes?: string;
  query_kind?: "milestone_status" | "month_summary" | "category_total";
  // rotina (null = tem que vir null)
  title_includes?: string;
  due_on?: string | null;
  moves_revenue?: boolean;
  task_ref_includes?: string;
  habit_ref?: string;
  date?: string | null;
  label_includes?: string;
  minutes?: number;
}

const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/ingest.json"), "utf8")) as {
  now: string;
  context: { habits: string[]; openTasks: string[]; goals: string[]; openTimer: { label: string | null; minutes: number } | null };
  cases: { text: string; expect: Expected[] }[];
};

// Categorias padrão (seed da migration).
const INCOME = ["Outras receitas", "Receita de cliente", "Setup/implantação"];
const EXPENSE = [
  "Alimentação", "Anúncios", "Assinaturas/Ferramentas", "Educação", "Lazer", "Moradia",
  "Outros", "Roupas", "Saúde", "Transporte/Combustível",
];

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Diferenças entre uma chamada e o esperado (vazio = bate). */
function mismatches(call: ToolCall, exp: Expected): string[] {
  const out: string[] = [];
  if (call.name !== exp.tool) return [`ferramenta ${call.name} ≠ ${exp.tool}`];
  if (call.name === "add_transaction") {
    const a = call.args;
    if (exp.kind && a.kind !== exp.kind) out.push(`kind ${a.kind} ≠ ${exp.kind}`);
    if (exp.amount_cents !== undefined) {
      const cents = parseBRL(a.amount);
      if (cents !== exp.amount_cents) out.push(`valor "${a.amount}" → ${cents} ≠ ${exp.amount_cents}`);
    }
    if (exp.category && a.category !== exp.category) out.push(`categoria "${a.category}" ≠ "${exp.category}"`);
    if (exp.occurred_on && a.occurred_on !== exp.occurred_on) out.push(`data ${a.occurred_on} ≠ ${exp.occurred_on}`);
    if (exp.counterparty_includes) {
      const who = norm(a.counterparty) + " " + norm(a.description);
      if (!who.includes(norm(exp.counterparty_includes))) out.push(`cliente "${a.counterparty}" sem "${exp.counterparty_includes}"`);
    }
  }
  if (call.name === "query") {
    if (exp.query_kind && call.args.kind !== exp.query_kind) out.push(`consulta ${call.args.kind} ≠ ${exp.query_kind}`);
    if (exp.category && call.args.category !== exp.category) out.push(`categoria "${call.args.category}" ≠ "${exp.category}"`);
  }
  if (call.name === "add_task") {
    const a = call.args;
    if (exp.title_includes && !norm(a.title).includes(norm(exp.title_includes))) out.push(`título "${a.title}" sem "${exp.title_includes}"`);
    if (exp.due_on !== undefined && a.due_on !== exp.due_on) out.push(`prazo ${a.due_on} ≠ ${exp.due_on}`);
    if (exp.moves_revenue !== undefined && a.moves_revenue !== exp.moves_revenue) out.push(`faturamento ${a.moves_revenue} ≠ ${exp.moves_revenue}`);
  }
  if (call.name === "complete_task" && exp.task_ref_includes && !norm(call.args.task_ref).includes(norm(exp.task_ref_includes))) {
    out.push(`tarefa "${call.args.task_ref}" sem "${exp.task_ref_includes}"`);
  }
  if (call.name === "log_habit") {
    if (exp.habit_ref && call.args.habit_ref !== exp.habit_ref) out.push(`hábito "${call.args.habit_ref}" ≠ "${exp.habit_ref}"`);
    if (exp.date !== undefined && call.args.date !== exp.date) out.push(`data ${call.args.date} ≠ ${exp.date}`);
  }
  if (call.name === "start_timer" && exp.label_includes && !norm(call.args.label).includes(norm(exp.label_includes))) {
    out.push(`timer "${call.args.label}" sem "${exp.label_includes}"`);
  }
  if (call.name === "log_time") {
    if (exp.minutes !== undefined && call.args.minutes !== exp.minutes) out.push(`minutos ${call.args.minutes} ≠ ${exp.minutes}`);
    if (exp.label_includes && !norm(call.args.label).includes(norm(exp.label_includes))) out.push(`rótulo "${call.args.label}" sem "${exp.label_includes}"`);
    if (exp.date !== undefined && call.args.date !== exp.date) out.push(`data ${call.args.date} ≠ ${exp.date}`);
  }
  return out;
}

describe.skipIf(!process.env.OPENAI_API_KEY)(`parser (${process.env.OPENAI_MODEL ?? "padrão"})`, () => {
  it.concurrent.each(fixtures.cases)("$text", async ({ text, expect: expected }) => {
    const { calls } = await parseMessage(text, {
      now: new Date(fixtures.now),
      incomeCategories: INCOME,
      expenseCategories: EXPENSE,
      ...fixtures.context,
    });

    // Casa cada esperado com uma chamada (ordem livre), sem sobrar nem faltar.
    const remaining = [...calls];
    const problems: string[] = [];
    for (const exp of expected) {
      const idx = remaining.findIndex((c) => mismatches(c, exp).length === 0);
      if (idx >= 0) remaining.splice(idx, 1);
      else problems.push(`esperado ${JSON.stringify(exp)}; mais próximo: ${mismatches(remaining[0] ?? calls[0]!, exp).join(", ") || "nenhuma chamada"}`);
    }
    if (remaining.length) problems.push(`chamadas a mais: ${JSON.stringify(remaining)}`);
    expect(problems, `"${text}" → ${JSON.stringify(calls)}`).toEqual([]);
  });
});
