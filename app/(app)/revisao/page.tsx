import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Revisão" />
      <EmptyState text="Fechamento do dia e revisão semanal chegam na Fase 2." />
    </>
  );
}
