"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Escuta mudanças nas tabelas (Supabase Realtime, respeitando o RLS) e re-renderiza a página
 * no servidor. É o que faz o anel subir sozinho quando um lançamento chega pelo WhatsApp.
 */
export function RealtimeRefresh({ tables }: { tables: readonly string[] }) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250); // agrupa rajadas (ex.: "desfaz" + novo)
    };
    const channel = supabase.channel(`refresh:${key}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();
    const onFocus = () => router.refresh(); // volta do background no iPhone: garante dados frescos
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [key, router]);

  return null;
}
