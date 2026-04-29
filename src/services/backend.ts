/**
 * Selector de backend (estricto):
 *  - Si Supabase NO está configurado → modo local (la app exige sesión, así que
 *    en la práctica esta rama sólo aparece si la build se sirve sin variables).
 *  - Si Supabase está configurado y hay sesión → modo "supabase".
 *  - Si Supabase está configurado pero NO hay sesión → no hay datos
 *    (las rutas privadas redirigen a /login antes de llegar aquí).
 */
import { isSupabaseConfigured, supabaseClient } from "@/integrations/supabase/client";

export type BackendMode = "local" | "supabase";

/** Mantenido por compatibilidad con código legado: ahora siempre devuelve "auto". */
export function getBackendPreference(): "auto" | BackendMode {
  return "auto";
}
export function setBackendPreference(_p: "auto" | BackendMode) {
  // Noop: ya no se permite forzar el modo. La sesión decide.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nexa:backend-change"));
  }
}

export function getBackendMode(): BackendMode {
  if (!isSupabaseConfigured() || !supabaseClient) return "local";
  return "supabase";
}

export async function getActiveUserId(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** True sólo si hay sesión real con la que servir lecturas/escrituras. */
export async function canUseSupabase(): Promise<boolean> {
  if (!supabaseClient) return false;
  const uid = await getActiveUserId();
  return Boolean(uid);
}

export function backendStatusLabel(): string {
  if (!isSupabaseConfigured()) return "Backend no configurado";
  return "Conectado a Lovable Cloud";
}
