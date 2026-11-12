import { GridBackground } from "@/components/hud/GridBackground";
import { Sidebar } from "@/components/ui/Sidebar";
import { TabBar } from "@/components/ui/TabBar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <GridBackground />
      <Sidebar />
      <div className="pt-safe lg:pl-60">
        <main className="mx-auto w-full max-w-content px-4 pt-6 pb-28 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <TabBar />
    </>
  );
}
