import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { Money } from "@/components/hud/Money";
import { RealtimeRefresh } from "@/components/hud/RealtimeRefresh";
import { CategoryBars } from "@/components/money/CategoryBars";
import { CumulativeChart } from "@/components/money/CumulativeChart";
import { MonthlyBarsChart } from "@/components/money/MonthlyBarsChart";
import { Statement } from "@/components/money/Statement";
import { StatementFilters } from "@/components/money/StatementFilters";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import type { DinheiroData } from "@/lib/data/dinheiro";
import { addMonths, formatMonthLong, monthKey, startOfMonth, type ISODate } from "@/lib/dates";
import { dinheiroHref, type DinheiroQuery } from "@/lib/dinheiro-query";
import { categoryBreakdown, cumulativeIncome, monthTotals } from "@/lib/metrics/money-report";
import { sumCents } from "@/lib/money";

/** Corpo da tela Dinheiro (server component). Recebe dados prontos: a página lê do Supabase, a vitrine /dev usa amostras. */
export function DinheiroView({
  data,
  query,
  month,
  today,
}: {
  data: DinheiroData;
  query: DinheiroQuery;
  month: ISODate;
  today: ISODate;
}) {
  const currentMonth = startOfMonth(today);
  const names = new Map(data.categories.map((c) => [c.id, c.name]));
  const totals = monthTotals(data.transactions, month);
  const pending = data.transactions.filter((t) => t.status === "pending_review").length;
  const cumulative = cumulativeIncome(data.transactions, month, today);
  const expenseSlices = categoryBreakdown(data.transactions, "expense", names);
  const incomeSlices = categoryBreakdown(data.transactions, "income", names);

  const filtered = data.transactions.filter(
    (t) => (!query.tipo || t.kind === query.tipo) && (!query.cat || t.category_id === query.cat),
  );
  const filtering = Boolean(query.tipo || query.cat);
  const filteredNet = sumCents(
    filtered.filter((t) => t.status === "confirmed").map((t) => (t.kind === "income" ? t.amount_cents : -t.amount_cents)),
  );

  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const isCurrent = month === currentMonth;
  const catHref = (id: string | null) => (id ? dinheiroHref({ ...query, cat: id, tipo: null }) : null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <RealtimeRefresh tables={["transactions"]} />

      <header className="flex items-center justify-between gap-2 lg:col-span-12">
        <div>
          <p className="label-instrument mb-1">Dinheiro</p>
          <h1 className="font-display text-xl font-semibold text-text-0 first-letter:uppercase">
            {formatMonthLong(month)}
          </h1>
        </div>
        <nav aria-label="Mês" className="flex items-center gap-1">
          <MonthLink href={dinheiroHref({ ...query, mes: monthKey(prev) })} label="Mês anterior">
            <ChevronLeft size={20} strokeWidth={1.5} />
          </MonthLink>
          {!isCurrent && (
            <Link
              href={dinheiroHref({ ...query, mes: monthKey(currentMonth) })}
              className="flex h-10 items-center rounded-sm px-2 text-sm text-text-1 hover:text-text-0"
            >
              Hoje
            </Link>
          )}
          <MonthLink
            href={month < currentMonth ? dinheiroHref({ ...query, mes: monthKey(next) }) : null}
            label="Próximo mês"
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </MonthLink>
        </nav>
      </header>

      {/* Receita × despesa do mês */}
      <div className="grid grid-cols-3 gap-2 lg:col-span-12">
        <SummaryTile label="Receita">
          <Money cents={totals.incomeCents} showCents={false} tone={totals.incomeCents > 0 ? "volt" : "default"} />
        </SummaryTile>
        <SummaryTile label="Despesa">
          <Money cents={totals.expenseCents} showCents={false} />
        </SummaryTile>
        <SummaryTile label="Saldo">
          <Money cents={totals.netCents} showCents={false} tone={totals.netCents < 0 ? "flare" : "default"} />
        </SummaryTile>
      </div>

      {/* Receita acumulada */}
      <HudCard
        label="Receita acumulada"
        action={
          data.monthTarget ? (
            <span className="num text-xs text-text-2">
              meta <Money cents={data.monthTarget.targetCents} showCents={false} />
            </span>
          ) : undefined
        }
        className="lg:col-span-5 lg:col-start-8 lg:row-start-3"
      >
        <CumulativeChart points={cumulative} targetCents={data.monthTarget?.targetCents} />
      </HudCard>

      {/* Extrato */}
      <section aria-label="Extrato" className="flex flex-col gap-3 lg:col-span-7 lg:col-start-1 lg:row-span-3 lg:row-start-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="label-instrument">Extrato</h2>
          {pending > 0 && (
            <Chip tone="alert">
              {pending} para revisar
            </Chip>
          )}
        </div>
        <StatementFilters query={query} categories={data.categories} />
        {filtering && filtered.length > 0 && (
          <p className="num flex items-center justify-between px-1 text-xs text-text-2">
            <span>
              {filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"}
            </span>
            <span>
              {filteredNet >= 0 ? "+" : "−"}
              <Money cents={Math.abs(filteredNet)} />
            </span>
          </p>
        )}
        {data.transactions.length === 0 ? (
          <HudCard>
            <p className="text-sm text-text-2">
              Nenhum lançamento em {formatMonthLong(month).split(" ")[0]}. Use o botão de captura ou Ctrl/⌘ K.
            </p>
          </HudCard>
        ) : filtered.length === 0 ? (
          <HudCard>
            <p className="text-sm text-text-2">
              Nada com esse filtro.{" "}
              <Link href={dinheiroHref({ ...query, tipo: null, cat: null })} className="text-volt underline underline-offset-4">
                Limpar filtros
              </Link>
            </p>
          </HudCard>
        ) : (
          <Statement transactions={filtered} categories={data.categories} />
        )}
      </section>

      {/* Categorias */}
      {(expenseSlices.length > 0 || incomeSlices.length > 0) && (
        <HudCard label="Categorias" className="lg:col-span-5 lg:col-start-8 lg:row-start-4">
          <div className="flex flex-col gap-6">
            {expenseSlices.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-2">Despesas</p>
                <CategoryBars slices={expenseSlices} kind="expense" hrefFor={catHref} />
              </div>
            )}
            {incomeSlices.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-2">Receitas</p>
                <CategoryBars slices={incomeSlices} kind="income" hrefFor={catHref} />
              </div>
            )}
          </div>
        </HudCard>
      )}

      {/* 12 meses */}
      <HudCard
        label="Últimos 12 meses"
        action={
          <span className="flex items-center gap-3 text-xs text-text-2">
            <Legend color="bg-volt" label="Receita" />
            <Legend color="bg-flare" label="Despesa" />
          </span>
        }
        className="lg:col-span-5 lg:col-start-8 lg:row-start-5"
      >
        <MonthlyBarsChart series={data.series} selected={month} />
      </HudCard>
    </div>
  );
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-bg-2 p-3">
      <span className="label-instrument truncate">{label}</span>
      <span className="truncate text-lg lg:text-2xl">{children}</span>
    </div>
  );
}

function MonthLink({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const cls = "flex size-10 items-center justify-center rounded-sm border border-line";
  if (!href) {
    return (
      <span aria-hidden className={cn(cls, "text-text-2 opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(cls, "text-text-1 hover:border-line-strong hover:text-text-0")}>
      {children}
    </Link>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}
