import Link from "next/link";
import { CalendarDays, Moon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Abas da Revisão em pílula: Hoje (fechamento do dia) · Semana. */
export function ReviewTabs({ active, base = "/revisao" }: { active: "hoje" | "semana"; base?: string }) {
  const tabs = [
    { value: "hoje" as const, label: "Hoje", icon: Moon, href: base },
    { value: "semana" as const, label: "Semana", icon: CalendarDays, href: `${base}?aba=semana` },
  ];
  return (
    <nav aria-label="Tipo de revisão" className="glass mb-5 flex w-full gap-1 rounded-full border border-line p-1 sm:w-auto sm:self-start">
      {tabs.map(({ value, label, icon: Icon, href }) => {
        const on = value === active;
        return (
          <Link
            key={value}
            href={href}
            prefetch
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm transition-[background-color,color,transform] duration-150 active:scale-95 sm:flex-none",
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
