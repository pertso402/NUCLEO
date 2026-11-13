"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCapture } from "@/components/capture/CaptureProvider";
import { NAV_ALL, isActive } from "./nav";
import { useOptimisticPath } from "./useOptimisticPath";

export function Sidebar() {
  const { path, go } = useOptimisticPath();
  const { open } = useCapture();
  return (
    <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line lg:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="neon-white font-display text-lg font-bold tracking-wide text-text-0">NÚCLEO</span>
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-volt shadow-glow-volt motion-safe:animate-[nucleo-pulse_2.4s_ease-in-out_infinite]"
        />
      </div>
      <nav aria-label="Navegação principal" className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ALL.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch // página inteira (com dados) já carregada em segundo plano: 1º toque também é instantâneo
                onClick={() => go(href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.97]",
                    active
                      ? "bg-linear-to-r from-volt/15 to-transparent text-text-0"
                      : "text-text-1 hover:bg-white/[0.04] hover:text-text-0",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-2 left-0 w-0.5 rounded-full bg-volt shadow-glow-volt transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className={active ? "text-volt drop-shadow-[0_0_6px_rgba(200,255,46,0.8)]" : "text-text-2"}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-3">
        <button
          type="button"
          onClick={() => open("palette")}
          className="flex h-10 w-full items-center gap-3 rounded-sm border border-volt/30 bg-volt/5 px-3 text-sm text-text-1 shadow-[0_0_12px_rgba(200,255,46,0.12)] transition-[border-color,color,box-shadow] duration-150 hover:border-volt/60 hover:text-text-0 hover:shadow-glow-volt"
        >
          <Plus size={20} strokeWidth={1.5} className="text-volt" />
          <span className="flex-1 text-left">Lançar</span>
          <kbd className="num text-xs text-text-2">Ctrl/⌘ K</kbd>
        </button>
      </div>
    </aside>
  );
}
