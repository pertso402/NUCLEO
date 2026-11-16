import { ComandoView } from "@/components/command/ComandoView";
import { getHighlightMilestone } from "@/lib/data/comando";
import { loadFollowups } from "@/lib/data/followups";
import { loadToday } from "@/lib/data/today";
import { hourInSP } from "@/lib/dates";

export default async function ComandoPage() {
  const now = new Date();
  const [highlight, today, followups] = await Promise.all([getHighlightMilestone(now), loadToday(now), loadFollowups(now)]);
  return <ComandoView highlight={highlight} today={today} hour={hourInSP(now)} followups={followups} nowIso={now.toISOString()} />;
}
