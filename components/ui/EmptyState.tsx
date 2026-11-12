import { HudCard } from "@/components/hud/HudCard";

export function EmptyState({ text }: { text: string }) {
  return (
    <HudCard>
      <p className="text-sm text-text-2">{text}</p>
    </HudCard>
  );
}
