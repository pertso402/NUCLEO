"use client";

import { useState } from "react";
import { FileUp, Landmark, MessageCircle, Mic, PenLine } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/hud/Money";
import { cn } from "@/lib/cn";
import { formatLongDate, formatShortDate } from "@/lib/dates";
import type { CategoryOption, Transaction } from "@/lib/data/dinheiro";
import { groupByDay } from "@/lib/metrics/money-report";
import { sumCents } from "@/lib/money";
import { TransactionEditor } from "./TransactionEditor";

const SOURCE = {
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  siri: { icon: Mic, label: "Siri" },
  app: { icon: PenLine, label: "App" },
  openfinance: { icon: Landmark, label: "Open Finance" },
  import: { icon: FileUp, label: "Importado" },
} as const;

/** Extrato agrupado por dia. Toque numa linha para editar no lugar. */
export function Statement({ transactions, categories }: { transactions: Transaction[]; categories: CategoryOption[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const days = groupByDay(transactions);

  return (
    <div className="flex flex-col gap-4">
      {days.map(({ date, items }) => {
        const confirmed = items.filter((t) => t.status === "confirmed");
        const net = sumCents(confirmed.map((t) => (t.kind === "income" ? t.amount_cents : -t.amount_cents)));
        return (
          <section key={date} aria-label={formatLongDate(date)}>
            <header className="mb-1 flex items-baseline justify-between px-1">
              <h3 className="label-instrument">
                <span className="num">{formatShortDate(date)}</span> · {formatLongDate(date).split(",")[0]}
              </h3>
              {confirmed.length > 0 && (
                <span className="num text-xs text-text-2">
                  {net >= 0 ? "+" : "−"}
                  <Money cents={Math.abs(net)} />
                </span>
              )}
            </header>
            <ul className="edge-light flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-bg-2/80">
              {items.map((t) => (
                <li key={t.id} className={editing === t.id ? "p-1" : undefined}>
                  {editing === t.id ? (
                    <TransactionEditor tx={t} categories={categories} onDone={() => setEditing(null)} />
                  ) : (
                    <Row
                      tx={t}
                      categoryName={t.category_id ? names.get(t.category_id) : undefined}
                      onEdit={() => setEditing(t.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({ tx, categoryName, onEdit }: { tx: Transaction; categoryName?: string; onEdit: () => void }) {
  const source = SOURCE[tx.source as keyof typeof SOURCE] ?? SOURCE.app;
  const Icon = source.icon;
  const title = tx.description || tx.counterparty || categoryName || (tx.kind === "income" ? "Receita" : "Despesa");
  const sub = tx.description && tx.counterparty ? tx.counterparty : null;
  const income = tx.kind === "income";
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-[background-color,transform] duration-150 hover:bg-white/[0.04] active:scale-[0.99]"
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0 text-text-2" aria-label={`via ${source.label}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm text-text-0 first-letter:uppercase">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Chip tone="category" className="h-5 min-w-0 shrink overflow-hidden text-ellipsis">
            {categoryName ?? "Sem categoria"}
          </Chip>
          {tx.status === "pending_review" && (
            <Chip tone="alert" className="h-5">
              revisar
            </Chip>
          )}
          {sub && <span className="truncate text-xs text-text-2">{sub}</span>}
        </span>
      </span>
      <span className={cn("num shrink-0 text-base", tx.status === "pending_review" && "opacity-60")}>
        <span className={income ? "neon-volt" : "text-text-1"}>{income ? "+" : "−"}</span>
        <Money cents={tx.amount_cents} tone={income ? "volt" : "default"} />
      </span>
    </button>
  );
}
