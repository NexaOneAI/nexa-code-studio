import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — Nexa One" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name || ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    setLoading(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Perfil actualizado");
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Perfil</h1>
      <div className="rounded-xl border border-border bg-card/40 p-6 space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled />
        </div>
        <div>
          <Label htmlFor="dn">Nombre</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <Button onClick={save} disabled={loading} className="bg-gradient-primary border-0">Guardar</Button>
      </div>
    </div>
  );
}