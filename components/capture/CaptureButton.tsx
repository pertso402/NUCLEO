"use client";

import { Mic } from "lucide-react";
import { useCapture } from "./CaptureProvider";

/**
 * Botão flutuante de captura (DESIGN §7), só no mobile — no desktop é o Ctrl/⌘+K.
 * Toque = abre o campo de texto. Segurar para gravar áudio entra na Fase 2.10.
 */
export function CaptureButton() {
  const { open } = useCapture();
  return (
    <button
      type="button"
      onClick={() => open("app")}
      aria-label="Lançar"
      className="fixed right-5 z-40 flex size-14 items-center justify-center rounded-full bg-volt text-bg-0 shadow-glow-volt transition-transform duration-150 active:scale-90 lg:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      {/* Halo pulsando: só opacity (barato) */}
      <span
        aria-hidden
        className="absolute -inset-1.5 rounded-full border border-volt/50 shadow-glow-volt motion-safe:animate-[nucleo-pulse_2.4s_ease-in-out_infinite]"
      />
      <Mic size={24} strokeWidth={1.75} className="relative" />
    </button>
  );
}
