import { ComandoView } from "@/components/command/ComandoView";
import { getHighlightMilestone } from "@/lib/data/comando";
import { loadToday } from "@/lib/data/today";
import { hourInSP } from "@/lib/dates";

export default async function ComandoPage() {
  const now = new Date();
  const [highlight, today] = await Promise.all([getHighlightMilestone(now), loadToday(now)]);
  return <ComandoView highlight={highlight} today={today} hour={hourInSP(now)} />;
}
