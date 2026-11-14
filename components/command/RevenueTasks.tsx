"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import type { RevenueTask } from "@/lib/data/today";
import { setTaskDone } from "@/app/(app)/rotina/actions";

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function due(d: string, today: string): { text: string; late: boolean } {
  if (d < today) return { text: `atrasada · ${d.slice(8, 10)}/${d.slice(5, 7)}`, late: true };
  if (d === today) return { text: "hoje", late: false };
  if (d === addDays(today, 1)) return { text: "amanhã", late: false };
  return { text: `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${d.slice(8, 10)}/${d.slice(5, 7)}`, late: false };
}

/** "Movem faturamento hoje" (DESIGN §9): 3 tarefas com checkbox direto. */
export function RevenueTasks({ tasks, doneToday, today }: { tasks: RevenueTask[]; doneToday: number; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [done, markDone] = useOptimistic<string[], string>([], (s, id) => [...s, id]);

  const complete = (id: string) => {
    setError(null);
    start(async () => {
      markDone(id);
      const r = await setTaskDone(id, true);
      if (!r.ok) setError(r.error);
    });
  };

  const doneCount = doneToday + done.length;

  return (
    <HudCard
      label="Movem faturamento"
      accent="volt"
      action={
        <Link href="/rotina" className="text-xs text-text-2 transition-colors hover:text-text-0">
          Rotina →
        </Link>
      }
    >
      {tasks.length === 0 ? (
        <p className="text-sm text-text-2">
          {doneCount > 0
            ? `${doneCount} feita${doneCount > 1 ? "s" : ""} hoje. Nenhuma outra na fila.`
            : "Nenhuma tarefa que mexe faturamento. Qual é o próximo passo pra entrar dinheiro?"}
        </p>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((t) => {
            const isDone = done.includes(t.id);
            const d = t.due_on ? due(t.due_on, today) : null;
            return (
              <li key={t.id} className="flex items-start gap-3 py-2">
                <button
                  type="button"
                  disabled={isDone}
                  aria-label={`Concluir: ${t.title}`}
                  onClick={() => complete(t.id)}
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-150 active:scale-90",
                    isDone ? "border-volt bg-volt text-bg-0 shadow-[0_0_10px_rgba(200,255,46,0.45)]" : "border-volt/60 hover:bg-volt/10",
                  )}
                >
                  {isDone && <Check size={14} strokeWidth={2.5} />}
                </button>
                <span className="min-w-0">
                  <span className={cn("block text-sm", isDone ? "text-text-2 line-through decoration-text-2/60" : "text-text-0")}>
                    {t.title}
                  </span>
                  {d && <span className={cn("num text-xs", d.late ? "text-ember" : "text-text-2")}>{d.text}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {doneCount > 0 && tasks.length > 0 && (
        <p className="num mt-1 text-xs text-text-2">
          <span className="neon-volt">{doneCount}</span> feita{doneCount > 1 ? "s" : ""} hoje
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-flare">
          {error}
        </p>
      )}
    </HudCard>
  );
}
