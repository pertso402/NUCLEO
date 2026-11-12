import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <EmptyState text="Configurações chegam junto das features que elas controlam." />
    </>
  );
}
