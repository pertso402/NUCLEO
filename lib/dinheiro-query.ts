import type { MoneyKind } from "@/lib/metrics/money-report";

/** Filtros da tela Dinheiro, que vivem na URL (`?mes=2026-11&tipo=expense&cat=<uuid>`). */
export interface DinheiroQuery {
  mes: string; // "2026-11"
  tipo: MoneyKind | null;
  cat: string | null;
  /** Rota base (padrão `/dinheiro`; a vitrine de dev usa outra). */
  base?: string;
}

/** Monta a URL da tela Dinheiro preservando os filtros. */
export function dinheiroHref(q: DinheiroQuery): string {
  const p = new URLSearchParams({ mes: q.mes });
  if (q.tipo) p.set("tipo", q.tipo);
  if (q.cat) p.set("cat", q.cat);
  return `${q.base ?? "/dinheiro"}?${p.toString()}`;
}
