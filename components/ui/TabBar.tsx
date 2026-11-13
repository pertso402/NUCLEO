"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { NAV_TABS, isActive } from "./nav";
import { useOptimisticPath } from "./useOptimisticPath";

/**
 * Tab bar mobile: doca de vidro flutuante. A aba acende no toque (antes da página chegar)
 * e o ícone ativo ganha brilho Volt.
 */
export function TabBar() {
  const { path, go } = useOptimisticPath();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-3 z-40 lg:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <ul className="glass edge-light mx-auto flex h-16 max-w-lg items-stretch rounded-lg border border-line-strong px-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {NAV_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href} className="relative flex-1">
              <Link
                href={href}
                prefetch // página inteira (com dados) já carregada em segundo plano: 1º toque também é instantâneo
                onClick={() => go(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-[color,transform] duration-150 active:scale-90",
                  active ? "text-text-0" : "text-text-2",
                )}
              >
                {/* Luz no topo da aba ativa */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-volt shadow-glow-volt transition-opacity duration-150",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  size={20}
                  strokeWidth={active ? 1.75 : 1.5}
                  className={cn(
                    "transition-colors duration-150",
                    active && "text-volt drop-shadow-[0_0_6px_rgba(200,255,46,0.8)]",
                  )}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
