import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Dinheiro" />
      <EmptyState text="Extrato e relatórios chegam na Fase 1." />
    </>
  );
}
