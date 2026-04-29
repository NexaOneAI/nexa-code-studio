/**
 * Helper para inyectar el token de Supabase como header `Authorization: Bearer`
 * en llamadas a server functions de TanStack Start.
 *
 * El middleware `requireSupabaseAuth` exige ese header, pero el cliente RPC
 * de TanStack no lo envía automáticamente (la sesión Supabase vive en
 * localStorage, no en cookies). Esta utilidad cierra esa brecha.
 */
import { supabaseClient } from "@/integrations/supabase/client";

export async function authedHeaders(): Promise<Record<string, string>> {
  if (!supabaseClient) return {};
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}