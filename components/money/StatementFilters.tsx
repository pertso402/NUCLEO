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
      <nav aria-label="Tipo" className="flex gap-1 rounded-sm border border-line bg-bg-1 p-1">
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
                "flex h-8 items-center rounded-sm px-3 text-sm transition-colors duration-150",
                active ? "bg-bg-3 text-text-0" : "text-text-2 hover:text-text-1",
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
        className="h-10 min-w-0 basis-full rounded-sm border border-line bg-bg-1 px-3 text-base text-text-1 focus:border-line-strong focus:outline-none sm:basis-auto"
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
