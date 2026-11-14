import { notFound } from "next/navigation";
import { GridBackground } from "@/components/hud/GridBackground";
import { DinheiroView } from "@/components/money/DinheiroView";
import type { CategoryOption, DinheiroData, Transaction } from "@/lib/data/dinheiro";
import { parseMonthKey } from "@/lib/dates";
import { lastMonthsSeries } from "@/lib/metrics/money-report";

/**
 * Vitrine de desenvolvimento da tela Dinheiro com dados fictícios.
 * Só existe em `next dev` (404 em produção). IDs falsos: salvar aqui não altera nada no banco.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const categories: CategoryOption[] = [
  { id: id(1), name: "Receita de cliente", kind: "income" },
  { id: id(2), name: "Setup/implantação", kind: "income" },
  { id: id(3), name: "Alimentação", kind: "expense" },
  { id: id(4), name: "Transporte", kind: "expense" },
  { id: id(5), name: "Ferramentas", kind: "expense" },
  { id: id(6), name: "Moradia", kind: "expense" },
];

let seq = 100;
const tx = (
  occurred_on: string,
  kind: "income" | "expense",
  amount_cents: number,
  category: number | null,
  description: string | null,
  counterparty: string | null = null,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: id(seq++),
  occurred_on,
  kind,
  amount_cents,
  category_id: category ? id(category) : null,
  description,
  counterparty,
  source: "whatsapp",
  status: "confirmed",
  ...extra,
});

const transactions: Transaction[] = [
  tx("2026-11-13", "expense", 4000, 3, "almoço", null, { source: "app" }),
  tx("2026-11-13", "income", 150000, 1, "mensalidade novembro", "Pizzaria do Zé"),
  tx("2026-11-12", "expense", 2390, 4, "uber", null, { source: "siri" }),
  tx("2026-11-11", "expense", 9900, 5, "assinatura figma", null, { source: "openfinance", status: "pending_review" }),
  tx("2026-11-10", "income", 250000, 2, "setup do cardápio digital", "Hamburgueria Brasa"),
  tx("2026-11-06", "expense", 120000, 6, "aluguel"),
  tx("2026-11-05", "expense", 8550, 3, "mercado"),
  tx("2026-11-03", "income", 80000, 1, null, "Açaí da Praça"),
  tx("2026-11-02", "expense", 1200, null, "estacionamento"),
];

const series = lastMonthsSeries(
  [
    { month: "2026-06-01", income_cents: 180000, expense_cents: 210000 },
    { month: "2026-07-01", income_cents: 320000, expense_cents: 190000 },
    { month: "2026-08-01", income_cents: 410000, expense_cents: 230000 },
    { month: "2026-09-01", income_cents: 380000, expense_cents: 250000 },
    { month: "2026-10-01", income_cents: 560000, expense_cents: 240000 },
    { month: "2026-11-01", income_cents: 480000, expense_cents: 135940 },
  ],
  "2026-11-01",
);

const data: DinheiroData = {
  categories,
  transactions,
  series,
  monthTarget: { title: "R$ 10k de receita", targetCents: 1_000_000 },
  rules: [
    { id: id(201), description: "Aluguel", amount_cents: 120_000, kind: "expense", category_id: id(6), day_of_month: 5, active: true, lead_id: null, last_generated_on: "2026-11-05" },
    { id: id(202), description: "Mensalidade Choppatinhas", amount_cents: 80_000, kind: "income", category_id: id(1), day_of_month: 10, active: true, lead_id: null, last_generated_on: "2026-11-10" },
    { id: id(203), description: "ChatGPT", amount_cents: 9_900, kind: "expense", category_id: id(5), day_of_month: 31, active: false, lead_id: null, last_generated_on: null },
  ],
};

export default async function DevDinheiroPage(props: PageProps<"/dev/dinheiro">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const tipo = typeof sp.tipo === "string" ? sp.tipo : null;
  const cat = typeof sp.cat === "string" ? sp.cat : null;
  const vazio = sp.vazio === "1";
  const month = parseMonthKey(typeof sp.mes === "string" ? sp.mes : null) ?? "2026-11-01";
  return (
    <>
      <GridBackground />
      <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8">
        <DinheiroView
          data={vazio || month !== "2026-11-01" ? { ...data, transactions: [] } : data}
          query={{
            mes: month.slice(0, 7),
            tipo: tipo === "income" || tipo === "expense" ? tipo : null,
            cat,
            base: "/dev/dinheiro",
          }}
          month={month}
          today="2026-11-13"
        />
      </main>
    </>
  );
}
