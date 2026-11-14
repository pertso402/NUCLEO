import "server-only";
import OpenAI from "openai";
import { acceptGenerated, fallbackMessage, mustInclude, type MessageFacts } from "./compose";

let client: OpenAI | null = null;
function openai(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 });
  return client;
}

const SYSTEM = [
  "Você escreve as mensagens automáticas do NÚCLEO, o app pessoal do Peter (autônomo, presta serviços), no WhatsApp.",
  "Tom: direto, motivador sem exagero, PT-BR informal. Frases curtas. Pode usar poucos emojis no início das linhas.",
  "Regras:",
  "- Use SÓ os fatos fornecidos. Não invente números, tarefas, clientes nem conselhos genéricos.",
  "- Copie valores em reais, percentuais, títulos de tarefas e links EXATAMENTE como vieram.",
  "- Máximo de 12 linhas. Sem markdown de título, sem negrito com asteriscos duplos.",
  "- Briefing da manhã: abra com bom dia, diga onde o marco está e o que fazer hoje para ele andar; liste as tarefas de faturamento numeradas; feche com o princípio do dia, se houver.",
  "- Fechamento do dia: placar honesto (score e o que pesou), reconheça o que foi feito, uma frase sobre amanhã, e termine com o link da revisão.",
  "- Revisão semanal: números da semana contra a anterior (sem inventar causas), peça vitórias, o que não deu certo e o foco da próxima semana, e termine com o link.",
].join("\n");

/**
 * Texto final da mensagem: a OpenAI reescreve os fatos; se ela falhar, demorar, ou mexer em
 * algum número/título obrigatório, usa a versão de reserva (determinística).
 */
export async function writeMessage(facts: MessageFacts): Promise<{ text: string; source: "openai" | "template"; error?: string }> {
  const fallback = fallbackMessage(facts);
  const ai = openai();
  if (!ai) return { text: fallback, source: "template", error: "OPENAI_API_KEY ausente" };
  try {
    const model = process.env.OPENAI_MODEL_BRIEFING || process.env.OPENAI_MODEL || "gpt-5.4-mini";
    const res = await ai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `Tipo: ${facts.kind === "briefing" ? "briefing da manhã" : facts.kind === "closing" ? "fechamento do dia" : "revisão semanal (domingo)"}.`,
            `Fatos (JSON): ${JSON.stringify(facts)}`,
            `Precisa aparecer exatamente: ${JSON.stringify(mustInclude(facts))}.`,
            "Rascunho de referência (pode melhorar o texto, sem perder nenhum fato):",
            fallback,
          ].join("\n"),
        },
      ],
    });
    const text = res.choices[0]?.message.content?.trim() ?? "";
    if (acceptGenerated(text, facts)) return { text, source: "openai" };
    return { text: fallback, source: "template", error: "texto da IA sem algum fato obrigatório" };
  } catch (err) {
    return { text: fallback, source: "template", error: err instanceof Error ? err.message : String(err) };
  }
}
