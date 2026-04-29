import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SupabaseStatusBanner } from "@/components/SupabaseStatusBanner";
import { useEffect, useState } from "react";
import { supabaseClient, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabaseClient) {
      // Sin backend no podemos validar sesión: bloquear y mandar a login.
      setChecking(false);
      setAuthed(false);
      nav({ to: "/login" });
      return;
    }
    const sb = supabaseClient;
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      const ok = !!s?.user;
      setAuthed(ok);
      setChecking(false);
      if (!ok) nav({ to: "/login" });
    });
    sb.auth.getSession().then(({ data }) => {
      const ok = !!data.session?.user;
      setAuthed(ok);
      setChecking(false);
      if (!ok) nav({ to: "/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background bg-gradient-hero">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!authed) return null;

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