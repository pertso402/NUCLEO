"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Exchange } from "./CaptureProvider";
import { ReplyView } from "./ReplyView";

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function CommandPalette({
  open,
  onClose,
  exchanges,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  exchanges: Exchange[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const busy = exchanges.some((x) => x.status === "pending");

  // Esc fecha; foco no campo ao abrir.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Rola para a última resposta.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [exchanges]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg-0/70 backdrop-blur-sm lg:items-start lg:pt-[18vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Lançar no NÚCLEO"
            className="pb-safe glass edge-light relative w-full max-w-xl rounded-t-lg border border-volt/25 shadow-[0_0_40px_rgba(200,255,46,0.12)] lg:rounded-lg"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <header className="flex items-center justify-between px-4 pt-4">
              <span className="label-instrument">Lançar</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-2 flex size-9 items-center justify-center rounded-sm text-text-2 hover:text-text-0"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </header>

            {exchanges.length > 0 && (
              <div ref={listRef} className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto px-4 pt-3">
                {exchanges.map((x) => (
                  <div key={x.id} className="flex flex-col gap-2">
                    <p className="num text-sm text-text-2">› {x.text}</p>
                    {x.status === "pending" ? (
                      <p className="flex items-center gap-2 text-sm text-text-2">
                        <LoaderCircle size={16} strokeWidth={1.5} className="animate-spin text-volt" />
                        Processando…
                      </p>
                    ) : (
                      x.reply && <ReplyView reply={x.reply} onUndo={() => onSend("desfaz")} undoDisabled={busy} />
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={submit} className="flex items-center gap-2 p-4">
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="gastei 40 no almoço…"
                autoComplete="off"
                enterKeyHint="send"
                maxLength={2000}
                aria-label="O que aconteceu?"
                className="num h-12 min-w-0 flex-1 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-volt/50 focus:shadow-[0_0_12px_rgba(200,255,46,0.15)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || busy}
                aria-label="Enviar"
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-sm bg-volt text-bg-0 shadow-[0_0_10px_rgba(200,255,46,0.35)] transition-[box-shadow,opacity,transform] duration-150 active:scale-90",
                  "hover:shadow-glow-volt disabled:opacity-40 disabled:hover:shadow-none",
                )}
              >
                <ArrowUp size={20} strokeWidth={2} />
              </button>
            </form>
            <p className="hidden px-4 pb-3 text-xs text-text-2 lg:block">
              Enter envia · Esc fecha · Ctrl/⌘ K abre e fecha
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
