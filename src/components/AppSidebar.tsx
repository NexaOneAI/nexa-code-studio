import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, FolderKanban, CreditCard, Shield, LogOut, User } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "./ui/button";

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
  const { user, signOut } = useAuth();
  const { balance, unlimited } = useCredits();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
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
          <div className="rounded-lg bg-sidebar-accent/40 p-3 text-xs">
            <div className="text-muted-foreground">Créditos</div>
            <div className="text-lg font-bold text-gradient">
              {unlimited ? "∞" : balance}
            </div>
          </div>
        )}
        {!collapsed && user && (
          <Link to="/profile" className="flex items-center gap-2 rounded-md p-2 text-xs hover:bg-sidebar-accent transition">
            <User className="h-4 w-4" />
            <span className="truncate">{user.email}</span>
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Salir</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}