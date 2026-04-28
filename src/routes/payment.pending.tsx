import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/pending")({
  head: () => ({ meta: [{ title: "Pago pendiente — Nexa One" }] }),
  component: PaymentPending,
});

function PaymentPending() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-primary/30 bg-card/60 backdrop-blur-xl p-8 text-center shadow-glow">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
          <Clock className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mt-5">Pago pendiente</h1>
        <p className="text-muted-foreground mt-2">
          Tu pago está siendo verificado por Mercado Pago. Tus créditos aparecerán en cuanto se confirme.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="bg-gradient-primary border-0">
            <Link to="/dashboard">Ir al dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/credits">Ver mis créditos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}