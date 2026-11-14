import "server-only";
import OpenAI from "openai";
import { addDays, formatLongDate, formatShortDate, todayISO, weekday, zonedParts } from "@/lib/dates";
import { TOOL_DEFINITIONS, ToolCallSchema, type ToolCall } from "./tools";

export interface ParserContext {
  now: Date;
  incomeCategories: string[];
  expenseCategories: string[];
  /** Hábitos ativos (nomes). */
  habits?: string[];
  /** Tarefas abertas (títulos, as de prazo mais próximo primeiro). */
  openTasks?: string[];
  /** Objetivos ativos (títulos). */
  goals?: string[];
  /** Timer rodando agora, se houver. */
  openTimer?: { label: string | null; minutes: number } | null;
  /** Se a mensagem anterior do mesmo canal pediu esclarecimento há pouco. */
  pendingClarification?: { originalText: string; question: string } | null;
}

export interface ParseResult {
  calls: ToolCall[];
  model: string;
  /** Saída bruta das tool calls (vai para `inbox_messages.parsed`). */
  raw: unknown;
}

let client: OpenAI | null = null;
function openai(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");
  client ??= new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });
  return client;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Próximos 7 dias com o nome do dia: o modelo não precisa fazer conta de calendário. */
function nextDays(today: string): string {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i + 1);
    return `${WEEKDAYS[weekday(d)]} ${formatShortDate(d)} = ${d}`;
  }).join("; ");
}

const quoted = (items: string[] | undefined, empty: string) =>
  items && items.length ? items.map((t) => `"${t}"`).join(", ") : empty;

export function buildSystemPrompt(ctx: ParserContext): string {
  const today = todayISO(ctx.now);
  const p = zonedParts(ctx.now);
  const hora = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const timer = ctx.openTimer
    ? `rodando há ${ctx.openTimer.minutes} min${ctx.openTimer.label ? ` ("${ctx.openTimer.label}")` : ""}`
    : "nenhum";
  return [
    "Você é o parser do NÚCLEO, o app pessoal do Peter (autônomo, presta serviços).",
    "Transforme a mensagem dele em chamadas de ferramenta. Nunca responda em texto livre.",
    `Agora em São Paulo: ${formatLongDate(today)} (${today}), ${hora}.`,
    `Ontem = ${addDays(today, -1)}. Próximos dias: ${nextDays(today)}.`,
    "Dia da semana citado ('sexta', 'na segunda') = a próxima ocorrência DEPOIS de hoje (use a lista acima).",
    "",
    "Regras:",
    "- Uma mensagem pode ter vários lançamentos: uma chamada de add_transaction para cada.",
    "- 'recebi', 'entrou', 'cliente pagou', 'fechei' com valor = income. 'gastei', 'paguei', 'comprei' = expense.",
    "- amount: copie o valor como ele falou (ex.: '1500', '38,90', '1,5 mil'). Não converta.",
    "- category: use EXATAMENTE um nome da lista do tipo certo. Sem encaixe claro: 'Outras receitas' (income) ou 'Outros' (expense).",
    "  Dicas: mercado, supermercado, padaria, iFood, lanche, almoço → Alimentação. Uber, 99, gasolina, estacionamento → Transporte/Combustível.",
    "  Aluguel, luz, água, gás, internet (de casa), condomínio → Moradia. ChatGPT, Claude, n8n, EasyPanel, domínio, hospedagem, Netflix, Spotify → Assinaturas/Ferramentas.",
    "  Farmácia, remédio, médico, dentista, exame, plano de saúde → Saúde. Curso, livro, mentoria → Educação. Roupa, tênis, camisa → Roupas.",
    "  Cinema, bar, show, viagem, passeio → Lazer. Tráfego pago, Meta Ads, Google Ads, impulsionar → Anúncios.",
    "  Pagamento de cliente por serviço → Receita de cliente; implantação/setup → Setup/implantação; pix de família/amigo, reembolso → Outras receitas.",
    "- occurred_on: só preencha se ele indicar outro dia ('ontem', 'na sexta'); calcule a data a partir de hoje. Senão null.",
    "- 'desfaz', 'apaga o último', 'errei' = undo_last.",
    "- Pergunta sobre números ('quanto falta', 'quanto gastei com X') = query.",
    "- Faltou o valor de um lançamento, ou não dá pra entender = ask_clarification com uma pergunta curta.",
    "",
    "Rotina:",
    "- 'tarefa:', 'preciso', 'tenho que', 'lembrar de', 'fulano pediu X, manda sexta' = add_task. Título curto no infinitivo, sem a data.",
    "- moves_revenue = true quando a tarefa leva a dinheiro: proposta, orçamento, cobrança, follow-up, reunião de venda, fechar cliente, prospectar.",
    "- 'fiz/mandei/terminei/concluí' + algo das tarefas abertas = complete_task (copie o título da lista). Se não estiver na lista e for hábito, log_habit; senão ask_clarification.",
    "- 'fiz academia', 'treinei', 'li', 'meditei' = log_habit com o nome EXATO do hábito da lista. Vários hábitos = várias chamadas. Hábito fora da lista = ask_clarification.",
    "- 'li 20 min' é o hábito de leitura (log_habit), não log_time. log_time é para trabalho ('trabalhei 2h no site').",
    "- 'começa timer X' / 'bora focar em X' = start_timer; 'para o timer' / 'parei o foco' = stop_timer.",
    "- Dinheiro junto com hábito ou tarefa na mesma mensagem: uma chamada para cada coisa.",
    "",
    `Categorias de receita: ${ctx.incomeCategories.join(", ")}.`,
    `Categorias de despesa: ${ctx.expenseCategories.join(", ")}.`,
    `Hábitos ativos: ${quoted(ctx.habits, "nenhum cadastrado")}.`,
    `Tarefas abertas: ${quoted(ctx.openTasks, "nenhuma")}.`,
    `Objetivos ativos: ${quoted(ctx.goals, "nenhum")}.`,
    `Timer: ${timer}.`,
  ].join("\n");
}

function buildMessages(text: string, ctx: ParserContext): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
  ];
  if (ctx.pendingClarification) {
    messages.push(
      { role: "user", content: ctx.pendingClarification.originalText },
      { role: "assistant", content: ctx.pendingClarification.question },
    );
  }
  messages.push({ role: "user", content: text });
  return messages;
}

function validate(toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined): ToolCall[] | null {
  if (!toolCalls?.length) return null;
  const out: ToolCall[] = [];
  for (const tc of toolCalls) {
    if (tc.type !== "function") return null;
    let args: unknown;
    try {
      args = JSON.parse(tc.function.arguments || "{}");
    } catch {
      return null;
    }
    const parsed = ToolCallSchema.safeParse({ name: tc.function.name, args });
    if (!parsed.success) return null;
    out.push(parsed.data);
  }
  return out;
}

/** Chama o modelo principal; se as tool calls vierem inválidas, tenta uma vez com o fallback. */
export async function parseMessage(text: string, ctx: ParserContext): Promise<ParseResult> {
  const models = [process.env.OPENAI_MODEL || "gpt-5.4-mini", process.env.OPENAI_MODEL_FALLBACK].filter(
    (m): m is string => Boolean(m),
  );
  let lastRaw: unknown = null;
  for (const model of models) {
    const res = await openai().chat.completions.create({
      model,
      messages: buildMessages(text, ctx),
      tools: TOOL_DEFINITIONS,
      tool_choice: "required",
      parallel_tool_calls: true,
    });
    const toolCalls = res.choices[0]?.message.tool_calls;
    lastRaw = toolCalls ?? res.choices[0]?.message ?? null;
    const calls = validate(toolCalls);
    if (calls) return { calls, model, raw: lastRaw };
  }
  throw new ParserError("O modelo não devolveu chamadas válidas", lastRaw);
}

export class ParserError extends Error {
  constructor(message: string, readonly raw: unknown) {
    super(message);
  }
}
