import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { CREDIT_COSTS, CREDIT_LABELS } from "@/lib/credit-costs";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { creditsService } from "@/services/credits.service";
import { supabaseClient } from "@/integrations/supabase/client";
import { CREDIT_PLAN_LIST, type CreditPlanId } from "@/lib/credit-plans";
import { createMercadoPagoPreference } from "@/server/mercadoPago.functions";
import { authedHeaders } from "@/lib/auth-headers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/credits")({
  head: () => ({ meta: [{ title: "Créditos — Nexa One" }] }),
  component: CreditsPage,
});

function CreditsPage() {
  const { balance, unlimited } = useCredits();
  const { user } = useAuth();
  const adminState = useIsAdmin();
  const isAdmin = typeof adminState === "boolean" ? adminState : adminState.isAdmin;
  const [tx, setTx] = useState<Array<{ id: string; amount: number; reason: string; created_at: string }>>([]);
  const [buyingPlan, setBuyingPlan] = useState<CreditPlanId | null>(null);
  const [reloading, setReloading] = useState(false);

  const planLabel = unlimited ? "Admin" : balance > 100 ? "Pro" : "Free";

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await creditsService.listTransactions();
      if (!alive) return;
      setTx(data);
    };
    load();
    let unsub: (() => void) | undefined;
    if (supabaseClient) {
      const { data: sub } = supabaseClient.auth.onAuthStateChange(() => load());
      unsub = () => sub.subscription.unsubscribe();
    }
    return () => { alive = false; unsub?.(); };
  }, []);

  const handleBuy = async (planId: CreditPlanId) => {
    if (isAdmin) {
      toast.info("Eres administrador: tus créditos son ilimitados.");
      return;
    }
    setBuyingPlan(planId);
    try {
      const res = await createMercadoPagoPreference({
        headers: await authedHeaders(),
        data: { plan_id: planId },
      });
      if (res?.payment_url) {
        window.location.href = res.payment_url;
      } else {
        toast.error("No se pudo iniciar el pago. Intenta de nuevo.");
        setBuyingPlan(null);
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error iniciando el pago");
      setBuyingPlan(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Créditos</h1>
        <p className="text-muted-foreground mt-1">Compra paquetes y revisa tu historial</p>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-gradient-primary/10 p-8 text-center shadow-glow">
        <CreditCard className="mx-auto h-8 w-8 text-primary" />
        <div className="mt-3 text-5xl font-bold text-gradient">{unlimited ? "∞" : balance}</div>
        <p className="text-muted-foreground mt-1">{unlimited ? "Créditos ilimitados activos" : "Créditos disponibles"}</p>
        <div className="mt-2 inline-flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planLabel === "Admin" ? "bg-primary/20 text-primary" : planLabel === "Pro" ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
            Plan: {planLabel}
          </span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Sincronizado con la nube</div>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={reloading}
            onClick={async () => {
              setReloading(true);
              try {
                if (!supabaseClient || !user) throw new Error("Sin sesión");
                const { error } = await supabaseClient.rpc("add_credits", {
                  _target_user: user.id,
                  _amount: 100,
                  _reason: "Recarga debug admin",
                });
                if (error) throw error;
                toast.success("Créditos recargados (+100)");
              } catch (e: any) {
                toast.error(e?.message ?? "Error recargando");
              } finally {
                setReloading(false);
              }
            }}
          >
            {reloading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Recargar créditos (admin)
          </Button>
        )}
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-1">Paquetes</h2>
        <p className="text-sm text-muted-foreground mb-4">Pago seguro con Mercado Pago Checkout Pro</p>
        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PLAN_LIST.map((p) => {
            const loading = buyingPlan === p.id;
            const disabled = buyingPlan !== null || isAdmin;
            return (
              <div
                key={p.id}
                className={`relative rounded-xl border p-6 transition ${
                  p.popular ? "border-primary shadow-glow bg-card/60" : "border-border bg-card/30"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-primary text-white shadow-glow">
                    MÁS POPULAR
                  </div>
                )}
                <div className="text-sm font-semibold text-primary uppercase tracking-wider">{p.name}</div>
                <div className="text-3xl font-bold mt-2">
                  {p.credits} <span className="text-sm font-normal text-muted-foreground">créditos</span>
                </div>
                <div className="text-2xl text-gradient font-bold mt-2">
                  ${p.price} <span className="text-sm text-muted-foreground font-normal">{p.currency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{p.description}</p>
                <Button
                  onClick={() => handleBuy(p.id)}
                  disabled={disabled}
                  className="w-full mt-4 bg-gradient-primary border-0 hover:opacity-90"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirigiendo…</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Comprar con Mercado Pago</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        {isAdmin && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Tu cuenta tiene créditos ilimitados, no necesitas comprar paquetes.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Costos por acción</h2>
        <div className="rounded-xl border border-border bg-card/30 divide-y divide-border">
          {(Object.keys(CREDIT_COSTS) as Array<keyof typeof CREDIT_COSTS>).map((k) => (
            <div key={k} className="flex items-center justify-between p-3 text-sm">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{CREDIT_LABELS[k]}</span>
              <span className="font-mono text-primary">{CREDIT_COSTS[k]} créditos</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Historial</h2>
        <div className="rounded-xl border border-border bg-card/30">
          {tx.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin movimientos aún</div>
          ) : tx.map((t) => (
            <div key={t.id} className="flex justify-between items-center p-3 border-b border-border last:border-0 text-sm">
              <div>
                <div className="font-medium">{t.reason}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className={`font-mono font-semibold ${t.amount > 0 ? "text-success" : "text-destructive"}`}>
                {t.amount > 0 ? "+" : ""}{t.amount}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}