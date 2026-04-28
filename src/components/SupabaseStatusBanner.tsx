import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseClient } from "@/integrations/supabase/client";
import { getBackendPreference, setBackendPreference } from "@/services/backend";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Aviso visible en cabecera cuando Supabase no está configurado o no hay sesión.
 * No bloquea la app: la app sigue funcionando en modo local.
 */
export function SupabaseStatusBanner() {
  const [hidden, setHidden] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [pref, setPref] = useState(getBackendPreference());

  useEffect(() => {
    if (!supabaseClient) {
      setHasSession(false);
      return;
    }
    supabaseClient.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_e, s) =>
      setHasSession(!!s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const h = () => setPref(getBackendPreference());
    window.addEventListener("nexa:backend-change", h);
    return () => window.removeEventListener("nexa:backend-change", h);
  }, []);

  if (hidden) return null;

  const configured = isSupabaseConfigured();

  // Caso 1: Supabase NO configurado.
  if (!configured) {
    return (
      <Banner tone="warn" onClose={() => setHidden(true)}>
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Supabase no configurado.</strong> La app funciona en modo local
          (datos en este navegador). Define <code className="text-xs bg-black/30 px-1 rounded">VITE_SUPABASE_URL</code> y{" "}
          <code className="text-xs bg-black/30 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> para activar el backend real.
        </span>
      </Banner>
    );
  }

  // Caso 2: Configurado pero sin sesión y preferencia auto/supabase.
  if (hasSession === false && pref !== "local") {
    return (
      <Banner tone="info" onClose={() => setHidden(true)}>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        <span>
          <strong>Supabase listo.</strong> Inicia sesión para sincronizar tus
          proyectos y créditos en la nube. Mientras tanto, todo se guarda local.
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setBackendPreference("local")}
        >
          Quedarme en local
        </Button>
      </Banner>
    );
  }

  // Caso 3: forzado local pero hay sesión.
  if (hasSession && pref === "local") {
    return (
      <Banner tone="info" onClose={() => setHidden(true)}>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Estás en modo local aunque hay sesión Supabase activa.
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setBackendPreference("auto")}
        >
          Usar Supabase
        </Button>
      </Banner>
    );
  }

  return null;
}

function Banner({
  tone,
  children,
  onClose,
}: {
  tone: "warn" | "info";
  children: React.ReactNode;
  onClose: () => void;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : "border-primary/40 bg-primary/10 text-foreground";
  return (
    <div className={`flex items-center gap-2 border-b ${cls} px-4 py-2 text-xs`}>
      <div className="flex flex-1 items-center gap-2">{children}</div>
      <button
        onClick={onClose}
        className="opacity-60 hover:opacity-100 transition"
        aria-label="Cerrar aviso"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}