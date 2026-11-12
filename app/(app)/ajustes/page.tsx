import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function Page() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="flex flex-col gap-4">
        <EmptyState text="Configurações chegam junto das features que elas controlam." />
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </div>
    </>
  );
}
