import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Marcos" />
      <EmptyState text="Marcos de receita chegam na Fase 1." />
    </>
  );
}
