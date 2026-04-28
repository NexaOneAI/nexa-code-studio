import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Nexa One Builder" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error("No se pudo iniciar sesión", { description: error.message }); return; }
    toast.success("Bienvenido de vuelta");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo size="lg" /></div>
        <div className="rounded-2xl border border-border bg-card/60 p-8 backdrop-blur shadow-elevated">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accede a tu cuenta de Nexa One</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary border-0">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-xs text-muted-foreground">
            <Link to="/reset-password" className="hover:text-primary">¿Olvidaste tu contraseña?</Link>
            <Link to="/register" className="hover:text-primary">Crear cuenta</Link>
          </div>
        </div>
      </div>
    </div>
  );
}