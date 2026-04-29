import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Sparkles, FolderKanban, CreditCard, Zap, Activity, Infinity as InfinityIcon, Shield, CheckCircle2, X, Rocket, Smartphone, ShoppingBag, History, ArrowRight, Plus } from "lucide-react";
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

      {/* Hero welcome */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-6 md:p-10">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-[color:var(--neon-violet)]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[color:var(--neon-cyan)]/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-violet)]/30 bg-[color:var(--neon-violet)]/10 text-xs font-medium text-[color:var(--neon-violet)]">
              <Sparkles className="h-3 w-3" /> Nexa One Builder
              {isAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide">
                  <Shield className="h-3 w-3" /> Admin
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              Bienvenido a <span className="text-gradient">Nexa One</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Crea apps reales listas para publicar — Web, PWA y Play Store en minutos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gradient-primary border-0 shadow-glow text-base">
              <Link to="/builder"><Plus className="mr-2 h-4 w-4" /> Crear nueva app</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[color:var(--neon-cyan)]/40 hover:bg-[color:var(--neon-cyan)]/10">
              <Link to="/projects">Mis proyectos</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Big action cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BigCard
          to="/builder"
          icon={Rocket}
          title="Crear nueva app"
          desc="Lanza el asistente IA y construye tu próxima Web App, PWA o Android."
          accent="violet"
          highlight
        />
        <BigCard
          to="/projects"
          icon={FolderKanban}
          title="Mis proyectos"
          desc={`${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"} en tu workspace.`}
          accent="cyan"
        />
        <BigCard
          to="/credits"
          icon={showUnlimited ? InfinityIcon : CreditCard}
          title="Créditos"
          desc={showUnlimited ? "Acceso ilimitado activo." : `${balance} créditos disponibles.`}
          accent={!showUnlimited && balance < 5 ? "warn" : "magenta"}
          rightSlot={
            !showUnlimited && (
              <CreditMeter balance={balance} />
            )
          }
        />
        <BigCard
          to="/builder"
          icon={Smartphone}
          title="Publicar en Play Store"
          desc="Exporta tu app como PWA lista para PWABuilder y Google Play."
          accent="cyan"
        />
        <BigCard
          to="/credits"
          icon={ShoppingBag}
          title="Comprar créditos"
          desc="Recarga con Mercado Pago — pagos seguros en MXN."
          accent="violet"
        />
        <BigCard
          to="/credits"
          icon={History}
          title="Historial IA"
          desc={`${genCount} ${genCount === 1 ? "generación realizada" : "generaciones realizadas"}.`}
          accent="magenta"
        />
      </div>

      {/* Compact stats strip */}
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
          <div className="rounded-xl glass-card divide-y divide-border/60 overflow-hidden">
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
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground glass-card">
            <FolderKanban className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3">Aún no tienes proyectos.</p>
            <Button asChild className="mt-4 bg-gradient-primary border-0"><Link to="/builder">Crear el primero</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to="/builder/$projectId" params={{ projectId: p.id }}
                className="group rounded-2xl glass-card p-5 hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300">
                <div className="font-semibold truncate">{p.name}</div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description || "Sin descripción"}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                </div>
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
    <div className={`rounded-2xl glass-card p-5 ${accent === "warn" ? "!border-amber-500/40" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${accent === "warn" ? "text-amber-400" : "text-gradient"}`}>{value}</div>
    </div>
  );
}

type Accent = "violet" | "cyan" | "magenta" | "warn";
const accentMap: Record<Accent, { ring: string; glow: string; icon: string }> = {
  violet: {
    ring: "hover:border-[color:var(--neon-violet)]/60",
    glow: "from-[color:var(--neon-violet)]/25 to-transparent",
    icon: "text-[color:var(--neon-violet)] bg-[color:var(--neon-violet)]/15",
  },
  cyan: {
    ring: "hover:border-[color:var(--neon-cyan)]/60",
    glow: "from-[color:var(--neon-cyan)]/20 to-transparent",
    icon: "text-[color:var(--neon-cyan)] bg-[color:var(--neon-cyan)]/15",
  },
  magenta: {
    ring: "hover:border-[color:var(--neon-magenta)]/60",
    glow: "from-[color:var(--neon-magenta)]/25 to-transparent",
    icon: "text-[color:var(--neon-magenta)] bg-[color:var(--neon-magenta)]/15",
  },
  warn: {
    ring: "hover:border-amber-500/60 !border-amber-500/40",
    glow: "from-amber-500/20 to-transparent",
    icon: "text-amber-400 bg-amber-500/15",
  },
};

function BigCard({
  to,
  icon: Icon,
  title,
  desc,
  accent = "violet",
  highlight = false,
  rightSlot,
}: {
  to: string;
  icon: any;
  title: string;
  desc: string;
  accent?: Accent;
  highlight?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const a = accentMap[accent];
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow ${a.ring} ${highlight ? "ring-1 ring-[color:var(--neon-violet)]/30" : ""}`}
    >
      <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} blur-2xl opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${a.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="relative mt-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{desc}</p>
        {rightSlot && <div className="mt-3">{rightSlot}</div>}
      </div>
    </Link>
  );
}

function CreditMeter({ balance }: { balance: number }) {
  const max = 100;
  const pct = Math.max(4, Math.min(100, (balance / max) * 100));
  const low = balance < 5;
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${low ? "bg-amber-400" : "bg-gradient-neon"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground">
        {low ? "Saldo bajo — recarga pronto" : "Saldo saludable"}
      </div>
    </div>
  );
}