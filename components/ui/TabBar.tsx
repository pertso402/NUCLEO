"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_TABS, isActive } from "./nav";

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-1 lg:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {NAV_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150",
                  active ? "text-text-0" : "text-text-2",
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className={active ? "text-volt" : undefined}
                />
                <span>{label}</span>
                <span
                  aria-hidden
                  className={cn("size-1 rounded-full", active ? "bg-volt" : "bg-transparent")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
