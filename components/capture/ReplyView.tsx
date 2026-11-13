import {
  BarChart3,
  Check,
  CircleAlert,
  CircleHelp,
  Receipt,
  TrendingUp,
  Trophy,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { parseReply, type ReplyLineKind } from "@/lib/ingest/reply-lines";
import { cn } from "@/lib/cn";

const ICONS: Record<Exclude<ReplyLineKind, "undo_hint" | "text">, { icon: LucideIcon; className: string }> = {
  done: { icon: Check, className: "text-volt" },
  milestone: { icon: TrendingUp, className: "text-volt" },
  achieved: { icon: Trophy, className: "text-gold" },
  undone: { icon: Undo2, className: "text-text-2" },
  question: { icon: CircleHelp, className: "text-ember" },
  summary: { icon: BarChart3, className: "text-ion" },
  category: { icon: Receipt, className: "text-ion" },
  error: { icon: CircleAlert, className: "text-flare" },
};

/** Resposta do ingest com ícones no lugar de emoji; a dica "desfaz" vira botão. */
export function ReplyView({ reply, onUndo, undoDisabled }: { reply: string; onUndo?: () => void; undoDisabled?: boolean }) {
  const lines = parseReply(reply);
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        if (line.kind === "undo_hint") {
          return onUndo ? (
            <li key={i}>
              <button
                type="button"
                onClick={onUndo}
                disabled={undoDisabled}
                className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-xs text-text-1 transition-colors duration-150 hover:text-text-0 disabled:opacity-50"
              >
                <Undo2 size={14} strokeWidth={1.5} />
                Desfazer
              </button>
            </li>
          ) : null;
        }
        const meta = line.kind === "text" ? null : ICONS[line.kind];
        const Icon = meta?.icon;
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-text-0">
            {Icon ? (
              <Icon size={16} strokeWidth={1.5} className={cn("mt-0.5 shrink-0", meta.className)} />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className={cn(line.kind === "text" && "text-text-1")}>{line.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
