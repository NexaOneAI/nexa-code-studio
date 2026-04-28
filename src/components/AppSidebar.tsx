import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, FolderKanban, CreditCard, RotateCcw } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "./ui/button";
import { localStore } from "@/lib/local-store";
import { toast } from "sonner";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Constructor IA", url: "/builder", icon: Sparkles },
  { title: "Proyectos", url: "/projects", icon: FolderKanban },
  { title: "Créditos", url: "/credits", icon: CreditCard },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { balance, unlimited } = useCredits();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border glass-card rounded-none">
      <SidebarHeader className="p-4">
        {!collapsed ? <Logo /> : <Logo size="sm" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Espacio de trabajo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && (
          <div className="relative rounded-xl p-3 text-xs glass-card neon-border overflow-hidden">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Créditos</div>
            <div className="mt-0.5 text-2xl font-black text-gradient">
              {unlimited ? "∞" : balance}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px nexa-shimmer opacity-60" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start hover:bg-sidebar-accent/60 hover:text-[color:var(--neon-cyan)]"
          onClick={() => {
            if (confirm("¿Reiniciar todos los datos locales (proyectos, créditos, historial)?")) {
              localStore.reset();
              toast.success("Datos locales reiniciados");
            }
          }}
        >
          <RotateCcw className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Reiniciar demo</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}