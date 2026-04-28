/**
 * Selector de backend: decide si usar Supabase real o el store local.
 * Reglas:
 *  - Si Supabase NO está configurado → forzamos modo local.
 *  - Si Supabase está configurado pero el usuario no inició sesión →
 *    seguimos en modo local (no rompemos la demo).
 *  - Si hay sesión real → modo "supabase".
 *
 * El usuario puede forzar el modo desde la UI guardando una preferencia.
 */
import { isSupabaseConfigured, supabaseClient } from "@/integrations/supabase/client";

export type BackendMode = "local" | "supabase";

const PREF_KEY = "nexa.backend.pref";

export function getBackendPreference(): "auto" | BackendMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(PREF_KEY);
  return v === "local" || v === "supabase" ? v : "auto";
}

export function setBackendPreference(p: "auto" | BackendMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, p);
  window.dispatchEvent(new CustomEvent("nexa:backend-change"));
}

/** Modo efectivo en este momento. */
export function getBackendMode(): BackendMode {
  const pref = getBackendPreference();
  if (pref === "local") return "local";
  if (!isSupabaseConfigured() || !supabaseClient) return "local";
  // Para Supabase real necesitamos sesión; lo decide getActiveUserId al usar.
  return pref === "supabase" ? "supabase" : "supabase";
}

/**
 * Devuelve el id del usuario autenticado en Supabase, o null.
 * Si no hay sesión, los servicios usan automáticamente el store local.
 */
export async function getActiveUserId(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** True si podemos hacer llamadas Supabase con un usuario real. */
export async function canUseSupabase(): Promise<boolean> {
  if (getBackendPreference() === "local") return false;
  if (!supabaseClient) return false;
  const uid = await getActiveUserId();
  return Boolean(uid);
}

export function backendStatusLabel(): string {
  if (!isSupabaseConfigured()) return "Local (Supabase no configurado)";
  return "Supabase listo · sesión opcional";
}