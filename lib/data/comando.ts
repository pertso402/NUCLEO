import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadHighlightMilestone, type HighlightMilestone } from "@/lib/data/milestone";

export type { HighlightMilestone };

/** Marco em destaque do usuário logado (RLS). */
export async function getHighlightMilestone(now: Date = new Date()): Promise<HighlightMilestone | null> {
  return loadHighlightMilestone(await createClient(), { now });
}
