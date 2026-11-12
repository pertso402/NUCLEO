import { GridBackground } from "@/components/hud/GridBackground";
import { HudCard } from "@/components/hud/HudCard";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <>
      <GridBackground />
      <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold text-text-0">NÚCLEO</span>
          <span aria-hidden className="size-2 rounded-full bg-volt" />
        </div>
        <HudCard variant="target" label="Acesso">
          <LoginForm />
        </HudCard>
        <p className="text-xs text-text-2">
          No iPhone: Safari → Compartilhar → <span className="text-text-1">Adicionar à Tela de Início</span>.
        </p>
      </main>
    </>
  );
}
