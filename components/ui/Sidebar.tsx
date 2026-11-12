"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ALL, isActive } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-bg-1 lg:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="font-display text-lg font-bold tracking-wide text-text-0">NÚCLEO</span>
        <span aria-hidden className="size-1.5 rounded-full bg-volt" />
      </div>
      <nav aria-label="Navegação principal" className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ALL.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-150",
                    active
                      ? "bg-bg-3 text-text-0"
                      : "text-text-1 hover:bg-bg-2 hover:text-text-0",
                  )}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className={active ? "text-volt" : "text-text-2"}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-6 py-4">
        <span className="num text-xs text-text-2">Ctrl/⌘ K</span>
      </div>
    </aside>
  );
}
