import { CaptureButton } from "@/components/capture/CaptureButton";
import { CaptureProvider } from "@/components/capture/CaptureProvider";
import { GridBackground } from "@/components/hud/GridBackground";
import { RealtimeRefresh } from "@/components/hud/RealtimeRefresh";
import { Sidebar } from "@/components/ui/Sidebar";
import { TabBar } from "@/components/ui/TabBar";
import { Celebration } from "@/components/milestones/Celebration";
import { loadRecentAchievements } from "@/lib/data/milestone";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Conquistas recentes: a celebração aparece em qualquer tela (uma vez por aparelho).
  const recent = await loadRecentAchievements(await createClient());
  return (
    <CaptureProvider>
      <GridBackground />
      {/* Um ouvinte só para o app inteiro: mudou lançamento/marco (WhatsApp, Siri, app), a tela atualiza
          e o cache das outras abas é descartado. Trocar de aba sem mudança usa o cache (instantâneo). */}
      <RealtimeRefresh tables={["transactions", "milestones"]} />
      <Sidebar />
      <div className="pt-safe lg:pl-60">
        <main className="mx-auto w-full max-w-content px-4 pt-6 pb-32 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <CaptureButton />
      <TabBar />
      <Celebration items={recent} />
    </CaptureProvider>
  );
}
