import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Rotina" />
      <EmptyState text="Tarefas, hábitos e tempo chegam na Fase 2." />
    </>
  );
}
