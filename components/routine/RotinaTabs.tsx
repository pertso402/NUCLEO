import Link from "next/link";
import { ListTodo, Repeat, Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RotinaTab } from "@/lib/data/routine";

const TABS: { value: RotinaTab; label: string; icon: typeof ListTodo }[] = [
  { value: "tarefas", label: "Tarefas", icon: ListTodo },
  { value: "habitos", label: "Hábitos", icon: Repeat },
  { value: "tempo", label: "Tempo", icon: Timer },
];

/** Abas da Rotina em pílula. Cada aba é uma URL (`?aba=`), com prefetch: troca instantânea. */
export function RotinaTabs({ active, base = "/rotina" }: { active: RotinaTab; base?: string }) {
  return (
    <nav aria-label="Seções da rotina" className="glass mb-5 flex w-full gap-1 rounded-full border border-line p-1 sm:w-auto sm:self-start">
      {TABS.map(({ value, label, icon: Icon }) => {
        const on = value === active;
        return (
          <Link
            key={value}
            href={value === "tarefas" ? base : `${base}?aba=${value}`}
            prefetch
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm transition-[background-color,color,transform] duration-150 active:scale-95 sm:flex-none",
              on
                ? "bg-volt/15 text-volt shadow-[inset_0_0_0_1px_rgba(200,255,46,0.4),0_0_12px_rgba(200,255,46,0.2)]"
                : "text-text-2 hover:text-text-1",
            )}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
