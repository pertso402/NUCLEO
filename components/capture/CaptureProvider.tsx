"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";

export type CaptureChannel = "app" | "palette";

export interface Exchange {
  id: number;
  text: string;
  status: "pending" | "ok" | "needs_clarification" | "error";
  reply: string | null;
  /** "audio": veio do botão de gravar (o texto é a transcrição). */
  kind?: "text" | "audio";
}

interface CaptureContextValue {
  open: (channel: CaptureChannel) => void;
  /** Envia um áudio gravado no botão (abre a palette para mostrar a resposta). */
  sendAudio: (audio: Blob) => void;
  /** Mostra um aviso na palette (ex.: microfone bloqueado). */
  notify: (reply: string) => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function useCapture(): CaptureContextValue {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture fora do CaptureProvider");
  return ctx;
}

let nextId = 1;

/**
 * Estado da captura no app: abre a palette (botão flutuante ou Ctrl/⌘+K), guarda as trocas
 * da sessão e envia tudo para /api/ingest com a sessão do usuário (sem token no navegador).
 */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [channel, setChannel] = useState<CaptureChannel | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  const open = useCallback((c: CaptureChannel) => setChannel(c), []);
  const close = useCallback(() => setChannel(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setChannel((c) => (c ? null : "palette"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const id = nextId++;
      setExchanges((xs) => [...xs.slice(-9), { id, text, status: "pending", reply: null }]);
      const update = (patch: Partial<Exchange>) =>
        setExchanges((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: channel ?? "app", text }),
        });
        if (res.status === 401) {
          update({ status: "error", reply: "⚠️ Sessão expirada. Entre de novo." });
          return;
        }
        const data = (await res.json()) as { status?: Exchange["status"]; reply_text?: string };
        update({
          status: data.status ?? (res.ok ? "ok" : "error"),
          reply: data.reply_text ?? "⚠️ Resposta inesperada do servidor.",
        });
        // O Realtime já atualiza o Comando; o refresh garante as outras telas.
        if (res.ok) router.refresh();
      } catch {
        update({ status: "error", reply: "⚠️ Sem conexão. Tenta de novo." });
      }
    },
    [channel, router],
  );

  const sendAudio = useCallback(
    async (audio: Blob) => {
      const id = nextId++;
      setChannel("app");
      setExchanges((xs) => [...xs.slice(-9), { id, text: "Transcrevendo…", status: "pending", reply: null, kind: "audio" }]);
      const update = (patch: Partial<Exchange>) =>
        setExchanges((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const form = new FormData();
        form.append("audio", audio, audio.type.includes("mp4") ? "audio.m4a" : "audio.webm");
        const res = await fetch("/api/ingest/audio", { method: "POST", body: form });
        const data = (await res.json()) as { status?: Exchange["status"]; reply_text?: string; transcript?: string | null };
        update({
          text: data.transcript || "(áudio)",
          status: data.status ?? (res.ok ? "ok" : "error"),
          reply: data.reply_text ?? "⚠️ Resposta inesperada do servidor.",
        });
        if (res.ok) router.refresh();
      } catch {
        update({ text: "(áudio)", status: "error", reply: "⚠️ Sem conexão. Tenta de novo." });
      }
    },
    [router],
  );

  const notify = useCallback((reply: string) => {
    const id = nextId++;
    setChannel("app");
    setExchanges((xs) => [...xs.slice(-9), { id, text: "(áudio)", status: "error", reply, kind: "audio" }]);
  }, []);

  const value = useMemo(() => ({ open, sendAudio, notify }), [open, sendAudio, notify]);

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <CommandPalette open={channel !== null} onClose={close} exchanges={exchanges} onSend={send} />
    </CaptureContext.Provider>
  );
}
