import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import { CREDIT_COSTS, CREDIT_LABELS } from "@/lib/credit-costs";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { subscribeStore } from "@/lib/local-store";
import { creditsService } from "@/services/credits.service";
import { supabaseClient } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/credits")({
  head: () => ({ meta: [{ title: "Créditos — Nexa One" }] }),
  component: CreditsPage,
});

const PACKS = [
  { credits: 50, price: "USD 9", popular: false },
  { credits: 150, price: "USD 24", popular: true },
  { credits: 400, price: "USD 59", popular: false },
];

function CreditsPage() {
  const { balance, unlimited, refresh } = useCredits();
  const [tx, setTx] = useState<Array<{ id: string; amount: number; reason: string; created_at: string }>>([]);
  const [isLocal, setIsLocal] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await creditsService.listTransactions();
      if (!alive) return;
      setTx(data);
      setIsLocal(await creditsService.isLocal());
    };
    load();
    const off = subscribeStore(load);
    let unsub: (() => void) | undefined;
    if (supabaseClient) {
      const { data: sub } = supabaseClient.auth.onAuthStateChange(() => load());
      unsub = () => sub.subscription.unsubscribe();
    }
    return () => { alive = false; off(); unsub?.(); };
  }, []);

  const addDemo = async (n: number) => {
    if (!isLocal) {
      toast.info("En modo Supabase los créditos se cargan vía pagos o admin.");
      return;
    }
    creditsService.addDemoLocal(n, `Recarga demo +${n}`);
    toast.success(`+${n} créditos añadidos (demo)`);
    refresh();
  };

  const toggleUnlimited = async () => {
    if (!isLocal) {
      toast.info("Modo ilimitado sólo disponible en local.");
      return;
    }
    creditsService.toggleUnlimitedLocal();
    toast.success(unlimited ? "Modo limitado" : "Modo ilimitado");
    refresh();
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
        {isLocal && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => addDemo(10)}><Plus className="h-3.5 w-3.5 mr-1" />+10 demo</Button>
            <Button size="sm" variant="outline" onClick={() => addDemo(50)}><Plus className="h-3.5 w-3.5 mr-1" />+50 demo</Button>
            <Button size="sm" variant="outline" onClick={toggleUnlimited}>
              {unlimited ? "Desactivar ilimitado" : "Activar ilimitado"}
            </Button>
          </div>
        )}
        {!isLocal && (
          <div className="mt-3 text-xs text-muted-foreground">Sincronizado con Supabase</div>
        )}
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Paquetes</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PACKS.map((p) => (
            <div key={p.credits} className={`rounded-xl border p-6 ${p.popular ? "border-primary shadow-glow bg-card/60" : "border-border bg-card/30"}`}>
              {p.popular && <div className="text-xs text-primary font-semibold mb-2">MÁS POPULAR</div>}
              <div className="text-3xl font-bold">{p.credits} <span className="text-sm font-normal text-muted-foreground">créditos</span></div>
              <div className="text-2xl text-gradient font-bold mt-2">{p.price}</div>
              <Button onClick={() => toast.info("Mercado Pago próximamente", { description: "El módulo de pagos estará disponible pronto." })}
                className="w-full mt-4 bg-gradient-primary border-0">Comprar</Button>
            </div>
          ))}
        </div>
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