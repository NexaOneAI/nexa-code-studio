import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { projectsService, type ProjectSummary } from "@/services/projects.service";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "Proyectos — Nexa One" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [items, setItems] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const list = await projectsService.list();
      if (!alive) return;
      setItems(list);
      setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, []);

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este proyecto?")) return;
    try {
      await projectsService.remove(id);
    } catch (e: any) {
      toast.error("Error al eliminar", { description: e?.message });
      return;
    }
    toast.success("Proyecto eliminado");
    setItems((it) => it.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground mt-1">{items.length} proyectos</p>
        </div>
        <Button asChild className="bg-gradient-primary border-0"><Link to="/builder"><Sparkles className="h-4 w-4 mr-2" />Nuevo</Link></Button>
      </div>
      {loading ? <div className="text-muted-foreground">Cargando...</div> :
       items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <FolderKanban className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">No tienes proyectos aún</p>
          <Button asChild className="mt-4 bg-gradient-primary border-0"><Link to="/builder">Crear el primero</Link></Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card/40 p-5 hover:border-primary/50 transition group">
              <Link to="/builder/$projectId" params={{ projectId: p.id }} className="block">
                <div className="font-semibold truncate">{p.name}</div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2 min-h-[2.5em]">{p.description || "Sin descripción"}</p>
                <div className="mt-3 text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleString()}</div>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="mt-2 text-destructive opacity-0 group-hover:opacity-100 transition">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}