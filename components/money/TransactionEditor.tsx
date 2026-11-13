"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { CategoryOption, Transaction } from "@/lib/data/dinheiro";
import type { MoneyKind } from "@/lib/metrics/money-report";
import { centsToInput, parseBRL } from "@/lib/money";
import {
  confirmTransaction,
  deleteTransaction,
  updateTransaction,
  type ActionResult,
} from "@/app/(app)/dinheiro/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-bg-3 px-3 text-base text-text-0 placeholder:text-text-2 focus:border-line-strong focus:outline-none";

/** Edição inline de um lançamento (abre no lugar da linha do extrato). */
export function TransactionEditor({
  tx,
  categories,
  onDone,
}: {
  tx: Transaction;
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<MoneyKind>(tx.kind);
  const [amount, setAmount] = useState(centsToInput(tx.amount_cents));
  const [date, setDate] = useState(tx.occurred_on);
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [description, setDescription] = useState(tx.description ?? "");
  const [counterparty, setCounterparty] = useState(tx.counterparty ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = categories.filter((c) => c.kind === kind);
  const amountValid = (parseBRL(amount) ?? 0) > 0;

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!amountValid) {
      setError("Valor inválido.");
      return;
    }
    run(() =>
      updateTransaction({
        id: tx.id,
        kind,
        amount,
        occurred_on: date,
        category_id: categoryId || null,
        description,
        counterparty,
      }),
    );
  }

  function changeKind(k: MoneyKind) {
    setKind(k);
    if (!categories.some((c) => c.id === categoryId && c.kind === k)) setCategoryId("");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-md border border-line-strong bg-bg-2 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-sm bg-bg-3 p-1" role="radiogroup" aria-label="Tipo">
        {(["income", "expense"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => changeKind(k)}
            className={cn(
              "h-9 rounded-sm text-sm transition-colors duration-150",
              kind === k ? (k === "income" ? "bg-volt-dim text-volt" : "bg-bg-2 text-flare") : "text-text-2",
            )}
          >
            {k === "income" ? "Receita" : "Despesa"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Valor (R$)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!amountValid}
            className={cn(field, "num", !amountValid && "border-flare/60")}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={cn(field, "num")}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label-instrument">Categoria</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
          <option value="">Sem categoria</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="label-instrument">Descrição</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="label-instrument">{kind === "income" ? "Cliente" : "Loja / pessoa"}</span>
        <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={200} className={field} />
      </label>

      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !amountValid}>
          Salvar
        </Button>
        {tx.status === "pending_review" && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => confirmTransaction(tx.id))}>
            <Check size={16} strokeWidth={1.75} />
            Confirmar
          </Button>
        )}
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => (confirmDelete ? run(() => deleteTransaction(tx.id)) : setConfirmDelete(true))}
          className={cn("ml-auto", confirmDelete && "text-flare hover:text-flare")}
        >
          <Trash2 size={16} strokeWidth={1.5} />
          {confirmDelete ? "Confirmar exclusão" : "Excluir"}
        </Button>
      </div>
    </form>
  );
}
