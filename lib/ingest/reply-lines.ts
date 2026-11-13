/**
 * A resposta do ingest é escrita para o WhatsApp (com emoji). A UI do app não usa emoji
 * (DESIGN §7): aqui cada linha vira { tipo, texto } e o componente troca o tipo por um ícone.
 */
export type ReplyLineKind =
  | "done" // ✅ lançamento registrado
  | "milestone" // 📈 estado do marco
  | "achieved" // 🏆 marco batido
  | "undone" // ↩️ Desfeito
  | "undo_hint" // ↩️ "desfaz" pra reverter → vira botão
  | "question" // ❓ pergunta
  | "summary" // 📊 resumo do mês
  | "category" // 🧾 total por categoria
  | "error" // ⚠️
  | "text";

export interface ReplyLine {
  kind: ReplyLineKind;
  text: string;
}

const PREFIXES: [string, ReplyLineKind][] = [
  ["✅", "done"],
  ["📈", "milestone"],
  ["🏆", "achieved"],
  ["❓", "question"],
  ["📊", "summary"],
  ["🧾", "category"],
  ["⚠️", "error"],
  ["↩️", "undone"],
];

export function parseReply(reply: string): ReplyLine[] {
  return reply
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      for (const [emoji, kind] of PREFIXES) {
        if (line.startsWith(emoji)) {
          const text = line.slice(emoji.length).trim();
          if (kind === "undone" && /^"desfaz"/.test(text)) return { kind: "undo_hint" as const, text };
          return { kind, text };
        }
      }
      return { kind: "text" as const, text: line };
    });
}
