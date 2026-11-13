import { MarcosView } from "@/components/milestones/MarcosView";
import { loadHighlightMilestone, loadMilestonesOverview } from "@/lib/data/milestone";
import { formatMonthShort, todayISO } from "@/lib/dates";
import { monthChoices } from "@/lib/metrics/milestones";
import { createClient } from "@/lib/supabase/server";

export default async function MarcosPage() {
  const now = new Date();
  const today = todayISO(now);
  const supabase = await createClient();
  const [highlight, overview] = await Promise.all([
    loadHighlightMilestone(supabase, { now }),
    loadMilestonesOverview(supabase, { now }),
  ]);
  const months = monthChoices(today).map((m) => ({ value: m.slice(0, 7), label: `${formatMonthShort(m)}/${m.slice(0, 4)}` }));
  return <MarcosView highlight={highlight} overview={overview} months={months} today={today} />;
}
