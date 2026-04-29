import { useState } from "react";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";

/**
 * Aviso visible solo cuando Supabase no está configurado.
 * Si hay sesión activa (caso normal) no muestra nada.
 */
export function SupabaseStatusBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  if (isSupabaseConfigured()) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 text-amber-100 px-4 py-2 text-xs">
      <div className="flex flex-1 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Backend no configurado.</strong> Faltan las variables de entorno
          de Lovable Cloud. Algunas funciones no estarán disponibles.
        </span>
      </div>
      <button
        onClick={() => setHidden(true)}
        className="opacity-60 hover:opacity-100 transition"
        aria-label="Cerrar aviso"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
