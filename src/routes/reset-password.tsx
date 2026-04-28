import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Recuperar contraseña — Nexa One" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) setRecoveryMode(true);
  }, []);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Te enviamos un enlace al email");
  };

  const updatePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contraseña actualizada");
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-background bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo size="lg" /></div>
        <div className="rounded-2xl border border-border bg-card/60 p-8 backdrop-blur shadow-elevated">
          <h1 className="text-2xl font-bold">{recoveryMode ? "Nueva contraseña" : "Recuperar acceso"}</h1>
          {recoveryMode ? (
            <form onSubmit={updatePwd} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="np">Nueva contraseña</Label>
                <Input id="np" type="password" required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              </div>
              <Button disabled={loading} className="w-full bg-gradient-primary border-0">Actualizar</Button>
            </form>
          ) : (
            <form onSubmit={sendLink} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button disabled={loading} className="w-full bg-gradient-primary border-0">Enviar enlace</Button>
            </form>
          )}
          <p className="mt-4 text-center text-xs"><Link to="/login" className="text-primary hover:underline">Volver al login</Link></p>
        </div>
      </div>
    </div>
  );
}