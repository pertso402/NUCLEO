import Link from "next/link";
import { Money } from "@/components/hud/Money";
import { cn } from "@/lib/cn";
import type { CategorySlice, MoneyKind } from "@/lib/metrics/money-report";

/** Quebra por categoria em barras horizontais. Cada linha filtra o extrato por aquela categoria. */
export function CategoryBars({
  slices,
  kind,
  hrefFor,
}: {
  slices: CategorySlice[];
  kind: MoneyKind;
  hrefFor: (categoryId: string | null) => string | null;
}) {
  const max = slices[0]?.totalCents ?? 0;
  return (
    <ul className="flex flex-col gap-3">
      {slices.map((s) => {
        const href = hrefFor(s.categoryId);
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-text-1">{s.name}</span>
              <span className="num shrink-0 text-text-0">
                <Money cents={s.totalCents} showCents={false} />
                <span className="ml-2 text-xs text-text-2">{Math.round(s.share * 100)}%</span>
              </span>
            </span>
            <span className="block h-1 overflow-hidden rounded-full bg-bg-3">
              <span
                className={cn("block h-full origin-left rounded-full", kind === "income" ? "bg-volt" : "bg-flare")}
                style={{ transform: `scaleX(${max > 0 ? s.totalCents / max : 0})` }}
              />
            </span>
          </>
        );
        return (
          <li key={s.categoryId ?? "none"}>
            {href ? (
              <Link href={href} scroll={false} className="flex flex-col gap-1.5 hover:[&_span.text-text-1]:text-text-0">
                {body}
              </Link>
            ) : (
              <div className="flex flex-col gap-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
