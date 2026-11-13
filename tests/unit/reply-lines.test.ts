import { describe, expect, it } from "vitest";
import { parseReply } from "@/lib/ingest/reply-lines";

describe("parseReply", () => {
  it("tira o emoji e marca o tipo de cada linha", () => {
    const reply = [
      "✅ Receita R$ 1.500 · Receita de cliente · Pizzaria",
      '📈 Marco "R$ 10k de receita": R$ 1.500 → faltam R$ 8.500 (15%)',
      '↩️ "desfaz" pra reverter',
    ].join("\n");
    expect(parseReply(reply)).toEqual([
      { kind: "done", text: "Receita R$ 1.500 · Receita de cliente · Pizzaria" },
      { kind: "milestone", text: 'Marco "R$ 10k de receita": R$ 1.500 → faltam R$ 8.500 (15%)' },
      { kind: "undo_hint", text: '"desfaz" pra reverter' },
    ]);
  });
  it("diferencia 'Desfeito' da dica de desfazer", () => {
    expect(parseReply("↩️ Desfeito: Despesa R$ 85 · Alimentação")[0]).toEqual({ kind: "undone", text: "Desfeito: Despesa R$ 85 · Alimentação" });
  });
  it("pergunta, consultas, erro e texto solto", () => {
    expect(parseReply("❓ Qual foi o valor?\n📊 novembro: receita R$ 0\n🧾 Alimentação: R$ 40\n⚠️ Falhou\nNenhum marco ativo agora.").map((l) => l.kind))
      .toEqual(["question", "summary", "category", "error", "text"]);
  });
  it("marco batido", () => {
    expect(parseReply('🏆 Marco "X" batido! R$ 10.500')[0]?.kind).toBe("achieved");
  });
});
