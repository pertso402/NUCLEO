"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { Money } from "@/components/hud/Money";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { CategoryOption } from "@/lib/data/dinheiro";
import type { RecurringRule } from "@/lib/recurring";
import { centsToInput, parseBRL } from "@/lib/money";
import {
  createRecurringRule,
  deleteRecurringRule,
  setRecurringRuleActive,
  updateRecurringRule,
  type ActionResult,
} from "@/app/(app)/dinheiro/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:outline-none";

/**
 * Lançamentos recorrentes (2.11): aluguel, assinaturas, mensalidades. No dia, a rotina diária cria
 * o lançamento como "para revisar" no extrato — você confirma com um toque.
 */
export function RecurringRules({ rules, categories }: { rules: RecurringRule[]; categories: CategoryOption[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const run = (fn: () => Promise<ActionResult>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  };

  const monthly = rules
    .filter((r) => r.active)
    .reduce((s, r) => s + (r.kind === "income" ? r.amount_cents : -r.amount_cents), 0);

  return (
    <HudCard
      label="Recorrentes"
      accent="ion"
      action={
        editing !== "new" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs text-text-1 transition-[color,border-color,transform] duration-150 hover:border-line-strong hover:text-text-0 active:scale-95"
          >
            <Plus size={14} strokeWidth={2} /> Nova
          </button>
        )
      }
    >
      <p className="mb-3 text-xs text-text-2">
        No dia, entra no extrato como <span className="text-ember">para revisar</span>. Confirme com um toque.
        {rules.some((r) => r.active) && (
          <>
            {" "}
            Saldo fixo por mês:{" "}
            <Money cents={Math.abs(monthly)} showCents={false} tone={monthly >= 0 ? "volt" : "default"} className="text-xs" />
            {monthly < 0 && " de saída"}.
          </>
        )}
      </p>

      {editing === "new" && (
        <div className="mb-3 rounded-md border border-volt/30 bg-white/[0.02] p-3">
          <RuleForm categories={categories} onDone={() => setEditing(null)} />
        </div>
      )}

      {error && (
        <p role="alert" className="mb-2 text-sm text-flare">
          {error}
        </p>
      )}

      {rules.length === 0 && editing !== "new" ? (
        <p className="text-sm text-text-2">Nenhuma recorrência. Cadastre aluguel, assinaturas e mensalidades de clientes.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rules.map((r) =>
            editing === r.id ? (
              <li key={r.id} className="py-3">
                <RuleForm rule={r} categories={categories} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={r.id} className={cn("flex items-center gap-3 py-2.5", !r.active && "opacity-50")}>
                <span
                  className={cn(
                    "num flex size-9 shrink-0 flex-col items-center justify-center rounded-sm border text-[10px] leading-none",
                    r.kind === "income" ? "border-volt/40 text-volt" : "border-line-strong text-text-1",
                  )}
                  aria-label={`Todo dia ${r.day_of_month}`}
                >
                  <span className="text-text-2">dia</span>
                  <span className="text-sm">{r.day_of_month}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-0">{r.description}</span>
                  <span className="block truncate text-xs text-text-2">
                    {r.category_id ? names.get(r.category_id) ?? "Sem categoria" : "Sem categoria"}
                    {!r.active && " · pausada"}
                  </span>
                </span>
                <Money
                  cents={r.amount_cents}
                  showCents={false}
                  tone={r.kind === "income" ? "volt" : "default"}
                  className="shrink-0 text-sm"
                />
                <span className="-mr-1 flex shrink-0">
                  <IconBtn label={`Editar ${r.description}`} onClick={() => setEditing(r.id)} disabled={pending}>
                    <Pencil size={14} strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn
                    label={r.active ? `Pausar ${r.description}` : `Retomar ${r.description}`}
                    onClick={() => run(() => setRecurringRuleActive(r.id, !r.active))}
                    disabled={pending}
                  >
                    {r.active ? <Pause size={14} strokeWidth={1.5} /> : <Play size={14} strokeWidth={1.5} />}
                  </IconBtn>
                  <IconBtn
                    label={confirmDelete === r.id ? `Confirmar exclusão de ${r.description}` : `Excluir ${r.description}`}
                    onClick={() => (confirmDelete === r.id ? run(() => deleteRecurringRule(r.id)) : setConfirmDelete(r.id))}
                    disabled={pending}
                    danger={confirmDelete === r.id}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </IconBtn>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </HudCard>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm transition-[color,transform] duration-150 active:scale-90 disabled:opacity-40",
        danger ? "text-flare" : "text-text-2 hover:text-text-0",
      )}
    >
      {children}
    </button>
  );
}

function RuleForm({ rule, categories, onDone }: { rule?: RecurringRule; categories: CategoryOption[]; onDone: () => void }) {
  const [kind, setKind] = useState<"income" | "expense">(rule?.kind ?? "expense");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amount_cents) : "");
  const [day, setDay] = useState(String(rule?.day_of_month ?? 5));
  const [categoryId, setCategoryId] = useState<string>(rule?.category_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = categories.filter((c) => c.kind === kind);
  const validAmount = (parseBRL(amount) ?? 0) > 0;
  const dayN = Number(day);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      description,
      amount,
      kind,
      category_id: options.some((c) => c.id === categoryId) ? categoryId : null,
      day_of_month: dayN,
    };
    start(async () => {
      const r = rule ? await updateRecurringRule(rule.id, input) : await createRecurringRule(input);
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="flex gap-1.5" role="radiogroup" aria-label="Tipo">
        {(
          [
            ["expense", "Despesa"],
            ["income", "Receita"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={kind === v}
            onClick={() => setKind(v)}
            className={cn(
              "flex h-8 items-center rounded-full border px-3.5 text-sm transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
              kind === v
                ? v === "income"
                  ? "border-volt/50 bg-volt/10 text-volt"
                  : "border-flare/50 bg-flare/10 text-flare"
                : "border-line text-text-2",
            )}
          >
            {l}
          </button>
        ))}
        <Repeat size={14} strokeWidth={1.5} className="ml-auto self-center text-text-2" aria-hidden />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={kind === "income" ? "Mensalidade do cliente X" : "Aluguel"}
        aria-label="Descrição"
        maxLength={120}
        className={field}
        autoFocus
      />
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor (R$)"
          aria-label="Valor"
          inputMode="decimal"
          className={cn(field, "num", amount && !validAmount && "border-flare/60")}
        />
        <label className="relative">
          <span className="sr-only">Dia do mês</span>
          <input
            value={day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            aria-label="Dia do mês"
            className={cn(field, "num pl-9", day && (dayN < 1 || dayN > 31) && "border-flare/60")}
          />
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-text-2">dia</span>
        </label>
      </div>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoria" className={field}>
        <option value="">Sem categoria</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {dayN >= 29 && <p className="text-xs text-text-2">Em mês mais curto, cai no último dia.</p>}
      {error && (
        <p role="alert" className="text-sm text-flare">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !description.trim() || !validAmount || !(dayN >= 1 && dayN <= 31)}>
          {rule ? "Salvar" : "Criar"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
