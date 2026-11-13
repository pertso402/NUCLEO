"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Caminho "otimista" para a navegação: ao tocar numa aba, ela acende na hora,
 * antes da página nova chegar do servidor. Quando o pathname muda, o real assume.
 */
export function useOptimisticPath(): { path: string; go: (href: string) => void } {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const path = pending && pending.from === pathname ? pending.href : pathname;
  return { path, go: (href) => setPending({ href, from: pathname }) };
}
