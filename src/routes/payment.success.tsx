import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPurchaseStatus } from "@/server/mercadoPago.functions";
import { useCredits } from "@/hooks/useCredits";
import { z } from "zod";

const Search = z.object({
  purchase_id: z.string().uuid().optional(),
  payment_id: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/payment/success")({
  validateSearch: (s) => Search.parse(s),
  head: () => ({ meta: [{ title: "Pago recibido — Nexa One" }] }),
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const { purchase_id } = useSearch({ from: "/payment/success" });
  const { refresh } = useCredits();
  const [status, setStatus] = useState<string>("checking");
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!purchase_id) {
      setStatus("unknown");
      return;
    }
    let alive = true;
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await getPurchaseStatus({ data: { purchase_id } });
        if (!alive) return;
        if (res.purchase) {
          setStatus(res.purchase.status);
          setCredits(res.purchase.credits);
          if (res.purchase.status === "approved") {
            refresh();
            return;
          }
        }
        attempts++;
        if (attempts < 10) setTimeout(poll, 2000);
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    return () => { alive = false; };
  }, [purchase_id, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-primary/30 bg-card/60 backdrop-blur-xl p-8 text-center shadow-glow">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
          {status === "approved" ? (
            <CheckCircle2 className="h-8 w-8 text-white" />
          ) : (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          )}
        </div>
        <h1 className="text-2xl font-bold mt-5">
          {status === "approved" ? "¡Pago recibido!" : "Procesando pago…"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {status === "approved"
            ? `Se acreditaron ${credits ?? ""} créditos a tu cuenta.`
            : "Tus créditos se están acreditando. Esto puede tardar unos segundos."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="bg-gradient-primary border-0">
            <Link to="/dashboard">Volver al dashboard <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/credits">Ver mis créditos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}