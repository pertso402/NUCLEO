"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Money } from "@/components/hud/Money";
import { RingProgress } from "@/components/hud/RingProgress";
import type { Achievement } from "@/lib/data/milestone";

const KEY = "nucleo:celebrated";
const EVENT = "nucleo:celebrated";

function readSeen(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function markSeen(id: string) {
  try {
    const ids = new Set(readSeen().split(",").filter(Boolean));
    ids.add(id);
    localStorage.setItem(KEY, [...ids].slice(-50).join(","));
  } catch {
    // sem storage (aba privada): a celebração some ao fechar e pode voltar ao recarregar — aceitável
  }
  window.dispatchEvent(new Event(EVENT));
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/**
 * Celebração de marco batido (DESIGN §6): tela cheia sobre `--bg-0` 92%, anel completo em Gold,
 * título em Unbounded, "Batido em DD/MM · N dias", partículas leves (canvas, ≤ 60, 1.6s), "Próximo marco →".
 * Aparece uma vez por aparelho para cada conquista dos últimos 7 dias.
 */
export function Celebration({ items }: { items: Achievement[] }) {
  const seen = useSyncExternalStore(subscribe, readSeen, () => null);
  const current = seen === null ? null : (items.find((a) => !seen.split(",").includes(a.id)) ?? null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && markSeen(current.id);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          role="dialog"
          aria-modal="true"
          aria-label={`Marco batido: ${current.title}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-0/92 px-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {!reduce && <Particles />}
          <button
            type="button"
            onClick={() => markSeen(current.id)}
            aria-label="Fechar"
            className="pt-safe absolute top-4 right-4 flex size-10 items-center justify-center rounded-full text-text-2 hover:text-text-0"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
          <motion.div
            className="relative flex max-w-md flex-col items-center gap-6 text-center"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p className="label-instrument !text-gold">Marco batido</p>
            <RingProgress value={1} achieved className="w-56 lg:w-64">
              <Money cents={current.currentCents} showCents={false} className="neon-white text-2xl" />
            </RingProgress>
            <h2 className="neon-gold font-display text-2xl leading-tight font-bold sm:text-3xl">{current.title}</h2>
            <p className="num text-sm text-text-1">
              Batido em {dateFmt.format(new Date(current.achievedAt))} · {current.days}{" "}
              {current.days === 1 ? "dia" : "dias"}
            </p>
            <Link
              href="/marcos"
              onClick={() => markSeen(current.id)}
              className="flex h-11 items-center rounded-sm bg-gold px-5 text-sm font-semibold text-bg-0 shadow-glow-gold transition-transform duration-150 active:scale-95"
            >
              Próximo marco →
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** ≤ 60 partículas em canvas por 1,6s (DESIGN §6). Desenha e para sozinho. */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#FFD24A", "#FFF1B8", "#C8FF2E"];
    const ps = Array.from({ length: 60 }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * 5;
      return {
        x: w / 2,
        y: h * 0.42,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 3,
        r: 1.5 + Math.random() * 2.5,
        c: colors[Math.floor(Math.random() * colors.length)]!,
      };
    });
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const k = (t - t0) / 1600;
      ctx.clearRect(0, 0, w, h);
      if (k >= 1) return;
      ctx.globalAlpha = 1 - k;
      for (const p of ps) {
        p.vy += 0.12;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
