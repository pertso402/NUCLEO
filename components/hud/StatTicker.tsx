"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import type { Cents } from "@/lib/money";
import { Money } from "./Money";

/**
 * Número que sobe contando quando o valor muda (DESIGN §5.4): 600ms, ease-out.
 * Na primeira renderização mostra o valor direto; com reduced-motion, troca direta sempre.
 */
export function StatTicker({
  cents,
  showCents = true,
  className,
}: {
  cents: Cents;
  showCents?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(cents);
  const previous = useRef(cents);

  useEffect(() => {
    const from = previous.current;
    previous.current = cents;
    if (from === cents || reduce) return;
    const controls = animate(from, cents, {
      duration: 0.6,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [cents, reduce]);

  // Com reduced-motion o valor é trocado direto, sem passar pelo estado animado.
  return <Money cents={reduce ? cents : shown} showCents={showCents} className={className} />;
}
