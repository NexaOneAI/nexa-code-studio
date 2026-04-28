import { useEffect, useState } from "react";
import { supabaseClient } from "@/integrations/supabase/client";

/**
 * Devuelve si el usuario actual tiene rol `admin` en `public.user_roles`.
 * Validación canónica: el backend (RLS + RPC) sigue siendo la fuente de verdad.
 * Este hook sólo afecta lo que se MUESTRA, nunca lo que se permite.
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!supabaseClient) {
      setLoading(false);
      return;
    }
    const check = async () => {
      const { data: s } = await supabaseClient!.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) {
        if (alive) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabaseClient!
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (alive) {
        setIsAdmin(!!data);
        setLoading(false);
      }
    };
    check();
    const { data: sub } = supabaseClient.auth.onAuthStateChange(() => check());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
}