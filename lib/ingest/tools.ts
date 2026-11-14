/**
 * Ferramentas que o modelo pode chamar (ARCHITECTURE §5.2) — definição para a OpenAI
 * (function calling em modo strict) + validação com Zod do que voltar.
 * Valores em dinheiro chegam como TEXTO ("1.500", "38,90", "1,5 mil") e o servidor
 * converte com `parseBRL` — o modelo nunca faz conta com float.
 */
import { z } from "zod";
import type OpenAI from "openai";

const nullableString = { type: ["string", "null"] } as const;

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_transaction",
      strict: true,
      description: "Registra uma receita ou despesa. Uma chamada por lançamento.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "amount", "category", "description", "counterparty", "occurred_on"],
        properties: {
          kind: { type: "string", enum: ["income", "expense"], description: "income = dinheiro entrando; expense = saindo" },
          amount: { type: "string", description: "Valor em reais exatamente como dito: '1500', '38,90', '1.500', '1,5 mil', '2k'" },
          category: { type: "string", description: "Uma das categorias da lista, com o nome exato" },
          description: { ...nullableString, description: "Descrição curta (ex.: 'almoço', 'gasolina')" },
          counterparty: { ...nullableString, description: "Cliente, loja ou pessoa, se citado" },
          occurred_on: { ...nullableString, description: "YYYY-MM-DD se a pessoa disse outro dia ('ontem', 'sexta'); null = hoje" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query",
      strict: true,
      description: "Responde uma pergunta sobre os números. Você só escolhe a consulta; os números vêm do servidor.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "category", "month"],
        properties: {
          kind: {
            type: "string",
            enum: ["milestone_status", "month_summary", "category_total"],
            description: "milestone_status = quanto falta pro marco; month_summary = receita/despesa/saldo do mês; category_total = total de uma categoria no mês",
          },
          category: { ...nullableString, description: "Só para category_total: nome exato da categoria" },
          month: { ...nullableString, description: "YYYY-MM; null = mês atual" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_task",
      strict: true,
      description: "Cria uma tarefa ('tarefa: …', 'preciso …', 'lembrar de …', 'tenho que …'). Uma chamada por tarefa.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["title", "due_on", "moves_revenue", "goal_ref"],
        properties: {
          title: { type: "string", description: "Tarefa curta no infinitivo, sem a data (ex.: 'Mandar proposta pra Sorveteria Gelato')" },
          due_on: { ...nullableString, description: "YYYY-MM-DD se ele disse quando ('sexta', 'amanhã', 'dia 20'); null = sem prazo" },
          moves_revenue: { type: "boolean", description: "true se mexe em faturamento: proposta, cobrança, follow-up de venda, fechar cliente, prospectar" },
          goal_ref: { ...nullableString, description: "Nome de um objetivo da lista, se a tarefa claramente serve a ele; senão null" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      strict: true,
      description: "Marca uma tarefa aberta como feita ('fiz a proposta', 'mandei o orçamento', 'concluí …').",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["task_ref"],
        properties: { task_ref: { type: "string", description: "Título da tarefa da lista de tarefas abertas (copie o mais parecido)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_habit",
      strict: true,
      description: "Marca um hábito como feito ('fiz academia', 'li 20 min', 'meditei'). Uma chamada por hábito.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["habit_ref", "date"],
        properties: {
          habit_ref: { type: "string", description: "Nome EXATO de um hábito da lista" },
          date: { ...nullableString, description: "YYYY-MM-DD se foi outro dia ('ontem'); null = hoje" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_timer",
      strict: true,
      description: "Começa a cronometrar um trabalho ('começa timer …', 'iniciando …', 'bora focar em …').",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        properties: { label: { ...nullableString, description: "No que ele vai trabalhar (ex.: 'cardápio Choppatinhas'); null se não disse" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stop_timer",
      strict: true,
      description: "Para o timer que está rodando ('para o timer', 'parei', 'terminei o foco').",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "log_time",
      strict: true,
      description: "Registra tempo já trabalhado, sem timer ('trabalhei 2h no site', 'foquei 45 min em prospecção').",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["minutes", "label", "date"],
        properties: {
          minutes: { type: "integer", description: "Duração em minutos (1h30 = 90)" },
          label: { type: "string", description: "No que trabalhou" },
          date: { ...nullableString, description: "YYYY-MM-DD se foi outro dia; null = hoje" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "undo_last",
      strict: true,
      description: "Desfaz o último lançamento registrado ('desfaz', 'apaga o último', 'errei').",
      parameters: { type: "object", additionalProperties: false, required: [], properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_clarification",
      strict: true,
      description: "Use quando faltar algo essencial (ex.: o valor) ou a mensagem não for um lançamento nem uma pergunta.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["question"],
        properties: { question: { type: "string", description: "Pergunta curta, em PT-BR informal" } },
      },
    },
  },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("add_transaction"),
    args: z.object({
      kind: z.enum(["income", "expense"]),
      amount: z.string().min(1),
      category: z.string().min(1),
      description: z.string().nullable(),
      counterparty: z.string().nullable(),
      occurred_on: isoDate.nullable(),
    }),
  }),
  z.object({
    name: z.literal("query"),
    args: z.object({
      kind: z.enum(["milestone_status", "month_summary", "category_total"]),
      category: z.string().nullable(),
      month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
    }),
  }),
  z.object({
    name: z.literal("add_task"),
    args: z.object({
      title: z.string().trim().min(1).max(200),
      due_on: isoDate.nullable(),
      moves_revenue: z.boolean(),
      goal_ref: z.string().nullable(),
    }),
  }),
  z.object({ name: z.literal("complete_task"), args: z.object({ task_ref: z.string().trim().min(1) }) }),
  z.object({ name: z.literal("log_habit"), args: z.object({ habit_ref: z.string().trim().min(1), date: isoDate.nullable() }) }),
  z.object({ name: z.literal("start_timer"), args: z.object({ label: z.string().nullable() }) }),
  z.object({ name: z.literal("stop_timer"), args: z.object({}) }),
  z.object({
    name: z.literal("log_time"),
    args: z.object({ minutes: z.number().int().min(1).max(1440), label: z.string().trim().min(1), date: isoDate.nullable() }),
  }),
  z.object({ name: z.literal("undo_last"), args: z.object({}) }),
  z.object({ name: z.literal("ask_clarification"), args: z.object({ question: z.string().min(1) }) }),
]);

export type ToolCall = z.infer<typeof ToolCallSchema>;
