import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Sparkles, FolderKanban, CreditCard, Zap } from "lucide-react";
import { projectsService, type ProjectSummary } from "@/services/projects.service";
import { localStore, subscribeStore } from "@/lib/local-store";
import { supabaseClient } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nexa One" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { balance, unlimited } = useCredits();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [genCount, setGenCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const list = await projectsService.list();
      if (!alive) return;
      setProjects(list.slice(0, 6));
      // Generaciones: si hay sesión Supabase, contamos; si no, usamos local.
      if (supabaseClient) {
        const { data: sess } = await supabaseClient.auth.getSession();
        if (sess.session) {
          const { count } = await supabaseClient
            .from("generations")
            .select("id", { count: "exact", head: true });
          if (alive) setGenCount(count || 0);
          return;
        }
      }
      setGenCount(localStore.listGenerations().length);
    };
    refresh();
    const off = subscribeStore(refresh);
    return () => { alive = false; off(); };
  }, []);

  const name = "Creador";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hola, <span className="text-gradient">{name}</span></h1>
          <p className="text-muted-foreground mt-1">Bienvenido de vuelta a Nexa One Builder</p>
        </div>
        <Button asChild size="lg" className="bg-gradient-primary border-0 shadow-glow">
          <Link to="/builder"><Sparkles className="mr-2 h-4 w-4" /> Crear nuevo proyecto</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={CreditCard} label="Créditos" value={unlimited ? "Ilimitado" : String(balance)} />
        <Stat icon={FolderKanban} label="Proyectos" value={String(projects.length)} />
        <Stat icon={Zap} label="Generaciones" value={String(genCount)} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Proyectos recientes</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/projects">Ver todos</Link></Button>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <FolderKanban className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3">Aún no tienes proyectos.</p>
            <Button asChild className="mt-4 bg-gradient-primary border-0"><Link to="/builder">Crear el primero</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to="/builder/$projectId" params={{ projectId: p.id }}
                className="rounded-xl border border-border bg-card/40 p-5 hover:border-primary/50 hover:shadow-glow transition">
                <div className="font-semibold truncate">{p.name}</div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description || "Sin descripción"}</p>
                <div className="mt-3 text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className="mt-2 text-3xl font-bold text-gradient">{value}</div>
    </div>
  );
}