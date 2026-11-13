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
      className="fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-volt text-bg-0 shadow-glow-volt transition-transform duration-150 active:scale-95 lg:hidden"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 1rem)" }}
    >
      <Mic size={24} strokeWidth={1.75} />
    </button>
  );
}
