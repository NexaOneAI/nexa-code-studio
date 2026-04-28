import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/failure")({
  head: () => ({ meta: [{ title: "Pago no completado — Nexa One" }] }),
  component: PaymentFailure,
});

function PaymentFailure() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-destructive/40 bg-card/60 backdrop-blur-xl p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mt-5">Pago no completado</h1>
        <p className="text-muted-foreground mt-2">
          No se pudo procesar tu pago. No se realizó ningún cargo. Puedes intentar de nuevo.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="bg-gradient-primary border-0">
            <Link to="/credits">Volver a intentar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">Ir al dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}