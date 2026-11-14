"use client";

import { useState, useTransition, type FormEvent } from "react";
import { HudCard } from "@/components/hud/HudCard";
import { addPrinciple } from "@/app/(app)/actions";

const MOTTO = "Lançar tem que ser mais fácil que esquecer.";

/**
 * Princípio do dia (DESIGN §9): cantos de mira, Geist 16px itálico. Sem princípios cadastrados,
 * mostra o lema do NÚCLEO e um campo para cadastrar o primeiro.
 */
export function PrincipleCard({ principle }: { principle: { id: string; text: string } | null }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addPrinciple(text);
      if (r.ok) {
        setText("");
        setAdding(false);
      } else setError(r.error);
    });
  }

  return (
    <HudCard
      label="Princípio do dia"
      variant="target"
      action={
        !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-text-2 transition-colors hover:text-text-0">
            + princípio
          </button>
        )
      }
    >
      <p className="text-base leading-relaxed text-text-1 italic">{principle?.text ?? MOTTO}</p>
      {!principle && !adding && (
        <p className="mt-2 text-xs text-text-2">Cadastre os seus princípios: um aparece aqui a cada dia.</p>
      )}
      {adding && (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: Proposta enviada hoje vale mais que proposta perfeita semana que vem."
            maxLength={280}
            rows={2}
            autoFocus
            className="w-full rounded-sm border border-line bg-white/[0.04] px-3 py-2 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none"
          />
          {error && (
            <p role="alert" className="text-sm text-flare">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || text.trim().length < 3}
              className="h-9 rounded-sm bg-volt px-3 text-sm font-semibold text-bg-0 transition-transform duration-150 active:scale-95 disabled:opacity-50"
            >
              Salvar
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-9 px-3 text-sm text-text-1 hover:text-text-0">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </HudCard>
  );
}
