"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, HOLD_DELAY_MS, MAX_RECORDING_MS, MIN_RECORDING_MS, pickRecorderType } from "@/lib/ingest/audio";
import { useCapture } from "./CaptureProvider";

type Phase = "idle" | "arming" | "recording";

/**
 * Botão flutuante de captura (DESIGN §7), só no mobile — no desktop é o Ctrl/⌘+K.
 * Toque rápido = abre o campo de texto. Segurar = grava; soltar = envia; arrastar o dedo
 * para fora do botão = cancela. Pulso Volt enquanto grava. Máximo de 60 s.
 */
export function CaptureButton() {
  const { open, sendAudio, notify } = useCapture();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  /** O dedo já saiu enquanto o microfone ainda abria (permissão etc.). */
  const released = useRef(false);
  const cancelled = useRef(false);

  const cleanup = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (tick.current) clearInterval(tick.current);
    holdTimer.current = null;
    tick.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    setPhase("idle");
    setElapsed(0);
  };

  // Saiu da tela gravando: solta o microfone (a bolinha do iOS some).
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (tick.current) clearInterval(tick.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function startRecording() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      cleanup();
      notify("⚠️ Este navegador não grava áudio. Use o campo de texto.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (released.current) {
        // soltou antes do microfone abrir: trata como toque
        s.getTracks().forEach((t) => t.stop());
        cleanup();
        return;
      }
      stream.current = s;
      const type = pickRecorderType((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined);
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const duration = Date.now() - startedAt.current;
        const blob = new Blob(chunks.current, { type: rec.mimeType || type || "audio/mp4" });
        const skip = cancelled.current || duration < MIN_RECORDING_MS || blob.size === 0;
        cleanup();
        if (!skip) sendAudio(blob);
      };
      recorder.current = rec;
      startedAt.current = Date.now();
      rec.start();
      setPhase("recording");
      tick.current = setInterval(() => {
        const ms = Date.now() - startedAt.current;
        setElapsed(ms);
        if (ms >= MAX_RECORDING_MS) stop(false);
      }, 200);
      navigator.vibrate?.(15);
    } catch {
      cleanup();
      notify("⚠️ Sem acesso ao microfone. Libere em Ajustes → Safari → Microfone, ou use o campo de texto.");
    }
  }

  function stop(cancel: boolean) {
    cancelled.current = cancel;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    else cleanup();
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // segue o dedo mesmo se sair do botão
    } catch {
      // sem captura o gesto ainda funciona; só o "arrastar pra cancelar" fica menos preciso
    }
    released.current = false;
    setPhase("arming");
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      void startRecording();
    }, HOLD_DELAY_MS);
  }

  function onPointerUp() {
    released.current = true;
    if (holdTimer.current) {
      // toque rápido
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      setPhase("idle");
      open("app");
      return;
    }
    if (phase === "recording") stop(false);
  }

  /** Dedo saiu do botão: cancela a gravação. */
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (phase !== "recording") return;
    const r = e.currentTarget.getBoundingClientRect();
    const out = e.clientX < r.left - 24 || e.clientX > r.right + 24 || e.clientY < r.top - 48 || e.clientY > r.bottom + 24;
    if (out) {
      released.current = true;
      stop(true);
    }
  }

  function onPointerCancel() {
    released.current = true;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      setPhase("idle");
      return;
    }
    if (phase === "recording") stop(true);
  }

  const recording = phase === "recording";

  return (
    <>
      {recording && (
        <div
          role="status"
          aria-live="polite"
          className="glass fixed right-5 z-40 flex items-center gap-2 rounded-full border border-volt/40 px-4 py-2 text-sm text-text-0 shadow-glow-volt lg:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 10rem)" }}
        >
          <span className="size-2 rounded-full bg-volt shadow-glow-volt motion-safe:animate-[nucleo-pulse_1s_ease-in-out_infinite]" />
          <span className="num">{formatClock(elapsed)}</span>
          <span className="text-text-1">solte pra enviar · arraste pra cancelar</span>
        </div>
      )}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open("app");
          }
        }}
        aria-label={recording ? "Gravando. Solte para enviar" : "Lançar (toque) ou gravar áudio (segure)"}
        className={cn(
          "fixed right-5 z-40 flex size-14 touch-none items-center justify-center rounded-full bg-volt text-bg-0 shadow-glow-volt transition-transform duration-150 select-none [-webkit-touch-callout:none] lg:hidden",
          recording ? "scale-125" : "active:scale-90",
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
      >
        {/* Halo: pulsa devagar parado, rápido gravando (só opacity/transform) */}
        <span
          aria-hidden
          className={cn(
            "absolute rounded-full border border-volt/50 shadow-glow-volt",
            recording
              ? "-inset-3 motion-safe:animate-[nucleo-pulse_0.9s_ease-in-out_infinite]"
              : "-inset-1.5 motion-safe:animate-[nucleo-pulse_2.4s_ease-in-out_infinite]",
          )}
        />
        <Mic size={24} strokeWidth={recording ? 2.25 : 1.75} className="relative" />
      </button>
    </>
  );
}
