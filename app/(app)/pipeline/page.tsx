import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Pipeline" />
      <EmptyState text="Kanban e funil reverso chegam na Fase 3." />
    </>
  );
}
