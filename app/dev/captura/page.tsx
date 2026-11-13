"use client";

import { useState } from "react";
import { GridBackground } from "@/components/hud/GridBackground";
import { CommandPalette } from "@/components/capture/CommandPalette";
import type { Exchange } from "@/components/capture/CaptureProvider";

/** Vitrine de desenvolvimento da captura (só em `next dev`; o proxy não deixa abrir em produção). */
const SAMPLE: Exchange[] = [
  {
    id: 1,
    text: "recebi 1500 da pizzaria",
    status: "ok",
    reply: '✅ Receita R$ 1.500 · Receita de cliente · pizzaria\n📈 Marco "R$ 10k de receita": R$ 1.500 → faltam R$ 8.500 (15%)\n↩️ "desfaz" pra reverter',
  },
  { id: 2, text: "gastei no mercado", status: "needs_clarification", reply: "❓ Qual foi o valor do mercado?" },
  { id: 3, text: "quanto tá o mês?", status: "ok", reply: "📊 novembro: receita R$ 1.500 · despesa R$ 85 · saldo R$ 1.415" },
  { id: 4, text: "desfaz", status: "pending", reply: null },
];

export default function DevCapturaPage() {
  const [exchanges, setExchanges] = useState(SAMPLE);
  const [open, setOpen] = useState(true);
  return (
    <>
      <GridBackground />
      <main className="p-6">
        <button className="text-sm text-volt underline" onClick={() => setOpen(true)}>
          abrir palette
        </button>
      </main>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        exchanges={exchanges}
        onSend={(text) => setExchanges((xs) => [...xs, { id: xs.length + 1, text, status: "ok", reply: `✅ Despesa R$ 40 · Alimentação · ${text}\n↩️ "desfaz" pra reverter` }])}
      />
    </>
  );
}
