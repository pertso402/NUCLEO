"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { CategoryOption } from "@/lib/data/dinheiro";
import type { MoneyKind } from "@/lib/metrics/money-report";
import { dinheiroHref, type DinheiroQuery } from "@/lib/dinheiro-query";

const KINDS: { value: MoneyKind | null; label: string }[] = [
  { value: null, label: "Tudo" },
  { value: "income", label: "Receitas" },
  { value: "expense", label: "Despesas" },
];

export function StatementFilters({ query, categories }: { query: DinheiroQuery; categories: CategoryOption[] }) {
  const router = useRouter();
  const options = query.tipo ? categories.filter((c) => c.kind === query.tipo) : categories;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Tipo" className="glass flex gap-1 rounded-full border border-line p-1">
        {KINDS.map((k) => {
          const active = query.tipo === k.value;
          // Trocar o tipo limpa a categoria se ela não for do novo tipo.
          const keepCat = query.cat && (!k.value || categories.find((c) => c.id === query.cat)?.kind === k.value);
          return (
            <Link
              key={k.label}
              href={dinheiroHref({ ...query, tipo: k.value, cat: keepCat ? query.cat : null })}
              aria-current={active ? "true" : undefined}
              scroll={false}
              className={cn(
                "flex h-8 items-center rounded-full px-3.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-95",
                active
                  ? "bg-volt/15 text-volt shadow-[inset_0_0_0_1px_rgba(200,255,46,0.4),0_0_12px_rgba(200,255,46,0.2)]"
                  : "text-text-2 hover:text-text-1",
              )}
            >
              {k.label}
            </Link>
          );
        })}
      </nav>
      <select
        aria-label="Categoria"
        value={query.cat ?? ""}
        onChange={(e) => router.push(dinheiroHref({ ...query, cat: e.target.value || null }), { scroll: false })}
        className="glass h-10 min-w-0 basis-full rounded-full border border-line px-4 text-base text-text-1 focus:border-line-strong focus:outline-none sm:basis-auto"
      >
        <option value="">Todas as categorias</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {query.tipo ? "" : c.kind === "income" ? " · receita" : " · despesa"}
          </option>
        ))}
      </select>
    </div>
  );
}
