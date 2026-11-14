import { notFound } from "next/navigation";
import { CaptureButton } from "@/components/capture/CaptureButton";
import { CaptureProvider } from "@/components/capture/CaptureProvider";
import { GridBackground } from "@/components/hud/GridBackground";

/**
 * Vitrine do botão de captura (404 em produção): toque abre o texto, segurar grava.
 * Sem login o envio volta "Sessão expirada" — serve para testar o gesto sem gravar nada.
 */
export default function DevCapturaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <CaptureProvider>
      <GridBackground />
      <main className="mx-auto max-w-content px-4 pt-6">
        <p className="label-instrument">Vitrine</p>
        <h1 className="font-display text-xl font-semibold text-text-0">Botão de captura</h1>
        <p className="mt-2 text-sm text-text-1">Toque: campo de texto. Segure: grava; solte: envia; arraste pra fora: cancela.</p>
      </main>
      <CaptureButton />
    </CaptureProvider>
  );
}
