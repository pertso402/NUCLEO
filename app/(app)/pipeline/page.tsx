import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadBoard } from "@/lib/data/pipeline";
import { todayISO } from "@/lib/dates";

/** Pipeline (ARCHITECTURE §7.6). O funil reverso e as análises entram na 3.4 e 3.7. */
export default async function PipelinePage() {
  const now = new Date();
  return (
    <>
      <PageHeader title="Pipeline" kicker="Leads e próximos passos" />
      <PipelineBoard leads={await loadBoard(now)} today={todayISO(now)} nowIso={now.toISOString()} />
    </>
  );
}
