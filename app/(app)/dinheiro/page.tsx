import { DinheiroView } from "@/components/money/DinheiroView";
import { loadDinheiro } from "@/lib/data/dinheiro";
import { monthKey, parseMonthKey, startOfMonth, todayISO } from "@/lib/dates";
import type { DinheiroQuery } from "@/lib/dinheiro-query";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DinheiroPage(props: PageProps<"/dinheiro">) {
  const sp = await props.searchParams;
  const today = todayISO();
  const month = parseMonthKey(one(sp.mes)) ?? startOfMonth(today);
  const tipo = one(sp.tipo);
  const cat = one(sp.cat);

  const query: DinheiroQuery = {
    mes: monthKey(month),
    tipo: tipo === "income" || tipo === "expense" ? tipo : null,
    cat: cat && UUID_RE.test(cat) ? cat : null,
  };

  return <DinheiroView data={await loadDinheiro(month)} query={query} month={month} today={today} />;
}
