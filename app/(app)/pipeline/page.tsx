import { FunnelPanel } from "@/components/pipeline/FunnelPanel";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadFunnel } from "@/lib/data/funnel";
import { loadBoard } from "@/lib/data/pipeline";
import { todayISO } from "@/lib/dates";

/** Pipeline (ARCHITECTURE §7.6): funil reverso no topo e o kanban. As análises entram na 3.7. */
export default async function PipelinePage(props: PageProps<"/pipeline">) {
  const sp = await props.searchParams;
  const leadParam = Array.isArray(sp.lead) ? sp.lead[0] : sp.lead;
  const now = new Date();
  const [funnel, leads] = await Promise.all([loadFunnel(now), loadBoard(now)]);
  return (
    <>
      <PageHeader title="Pipeline" kicker="Leads e próximos passos" />
      <div className="flex flex-col gap-5">
        <FunnelPanel data={funnel} />
        <PipelineBoard leads={leads} today={todayISO(now)} nowIso={now.toISOString()} initialOpenId={leadParam ?? null} />
      </div>
    </>
  );
}
