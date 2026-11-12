import {
  CalendarCheck,
  Flag,
  Gauge,
  KanbanSquare,
  MoreHorizontal,
  NotebookPen,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ALL: NavItem[] = [
  { href: "/", label: "Comando", icon: Gauge },
  { href: "/dinheiro", label: "Dinheiro", icon: Wallet },
  { href: "/marcos", label: "Marcos", icon: Flag },
  { href: "/objetivos", label: "Objetivos", icon: Target },
  { href: "/rotina", label: "Rotina", icon: CalendarCheck },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/revisao", label: "Revisão", icon: NotebookPen },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

/** Tab bar mobile: Comando · Dinheiro · Pipeline · Rotina · Mais */
export const NAV_TABS: NavItem[] = [
  { href: "/", label: "Comando", icon: Gauge },
  { href: "/dinheiro", label: "Dinheiro", icon: Wallet },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/rotina", label: "Rotina", icon: CalendarCheck },
  { href: "/mais", label: "Mais", icon: MoreHorizontal },
];

/** Rotas que ficam dentro de "Mais" no mobile. */
export const NAV_MORE: NavItem[] = NAV_ALL.filter(
  (i) => !NAV_TABS.some((t) => t.href === i.href),
);

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/mais") {
    return pathname === "/mais" || NAV_MORE.some((i) => pathname.startsWith(i.href));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
