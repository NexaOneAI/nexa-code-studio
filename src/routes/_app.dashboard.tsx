import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Sparkles, FolderKanban, CreditCard, Zap, Activity, Infinity as InfinityIcon, Shield, CheckCircle2, X } from "lucide-react";
import { projectsService, type ProjectSummary } from "@/services/projects.service";
import { localStore, subscribeStore } from "@/lib/local-store";
import { supabaseClient } from "@/integrations/supabase/client";
import { creditsService } from "@/services/credits.service";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Badge } from "@/components/ui/badge";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nexa One" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { balance, unlimited } = useCredits();
  const { isAdmin } = useIsAdmin();
  const showUnlimited = unlimited || isAdmin;
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [genCount, setGenCount] = useState(0);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; reason: string; created_at: string }>>([]);
  const [lastApproved, setLastApproved] = useState<{ id: string; credits: number; plan_name: string } | null>(null);

  usePaymentNotifications({
    onApproved: (p) => setLastApproved(p),
  });

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
    const refreshTx = async () => {
      const tx = await creditsService.listTransactions();
      if (alive) setTransactions(tx.slice(0, 6));
    };
    refresh();
    refreshTx();
    const off = subscribeStore(() => { refresh(); refreshTx(); });
    return () => { alive = false; off(); };
  }, []);

  // Refresca transacciones cada vez que cambia el balance (créditos en tiempo real).
  useEffect(() => {
    creditsService.listTransactions().then((tx) => setTransactions(tx.slice(0, 6)));
  }, [balance, unlimited]);

  const name = "Creador";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {lastApproved && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/10 backdrop-blur-xl p-4 sm:p-5 shadow-glow flex items-start gap-4">
          <div className="shrink-0 mt-0.5 h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-emerald-300">¡Pago aprobado!</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Se acreditaron <strong className="text-foreground">{lastApproved.credits} créditos</strong> del plan{" "}
              <strong className="text-foreground">{lastApproved.plan_name}</strong> a tu cuenta.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" className="bg-gradient-primary border-0">
                <Link to="/credits">Ver historial de compras</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLastApproved(null)}>
                Cerrar
              </Button>
            </div>
          </div>
          <button
            onClick={() => setLastApproved(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 flex-wrap">
            Hola, <span className="text-gradient">{name}</span>
            {isAdmin && (
              <Badge
                variant="outline"
                className="gap-1 border-[color:var(--neon-violet)]/50 text-[color:var(--neon-violet)] bg-[color:var(--neon-violet)]/10"
              >
                <Shield className="h-3 w-3" /> Admin
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Bienvenido de vuelta a Nexa One Builder</p>
        </div>
        <Button asChild size="lg" className="bg-gradient-primary border-0 shadow-glow">
          <Link to="/builder"><Sparkles className="mr-2 h-4 w-4" /> Crear nuevo proyecto</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          icon={showUnlimited ? InfinityIcon : CreditCard}
          label="Créditos disponibles"
          value={showUnlimited ? "Ilimitados" : String(balance)}
          accent={!showUnlimited && balance < 5 ? "warn" : "ok"}
        />
        <Stat icon={FolderKanban} label="Proyectos" value={String(projects.length)} />
        <Stat icon={Zap} label="Generaciones" value={String(genCount)} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Consumo de créditos
          </h2>
          <Button asChild variant="ghost" size="sm"><Link to="/credits">Ver historial</Link></Button>
        </div>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no se han consumido créditos. Crea tu primera app.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 divide-y divide-border">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.reason}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <div className={`font-mono font-semibold ${t.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {t.amount > 0 ? "+" : ""}{t.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: "ok" | "warn" }) {
  return (
    <div className={`rounded-xl border bg-card/40 p-5 ${accent === "warn" ? "border-amber-500/40" : "border-border"}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${accent === "warn" ? "text-amber-400" : "text-gradient"}`}>{value}</div>
    </div>
  );
}