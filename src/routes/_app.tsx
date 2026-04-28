import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SupabaseStatusBanner } from "@/components/SupabaseStatusBanner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  // Modo local demo: no requerimos login. El backend queda preparado para activarse luego.
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background bg-gradient-hero">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-sidebar-border flex items-center px-4 gap-3 glass-card sticky top-0 z-10 rounded-none">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground tracking-wide">
              <span className="text-gradient font-semibold">Nexa One</span> Builder
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--neon-cyan)] shadow-neon animate-nexa-pulse" />
              AI Online
            </div>
          </header>
          <SupabaseStatusBanner />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}