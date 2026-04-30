import { useEffect, useState, useCallback } from "react";
import { CREDIT_COSTS, CreditAction, CREDIT_LABELS } from "@/lib/credit-costs";
import { toast } from "sonner";
import { creditsService } from "@/services/credits.service";
import { supabaseClient } from "@/integrations/supabase/client";

/**
 * Hook unificado de créditos.
 * - Si hay sesión Supabase: balance, consumo e historial vienen del backend real,
 *   con realtime sobre la tabla `credits`.
 * - Si no: cae al store local automáticamente.
 */
export function useCredits() {
  const [balance, setBalance] = useState<number>(0);
  const [unlimited, setUnlimited] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const c = await creditsService.getBalance();
    setBalance(c.balance);
    setUnlimited(c.unlimited);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    let cleanupRealtime: (() => void) | undefined;
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data }) => {
        const uid = data.session?.user.id;
        if (!uid) return;
        const chName = `credits-${uid}-${Date.now()}`;
        const ch = supabaseClient!
          .channel(chName)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "credits", filter: `user_id=eq.${uid}` },
            () => refresh(),
          )
          .subscribe();
        cleanupRealtime = () => { supabaseClient!.removeChannel(ch); };
      });

      const { data: sub } = supabaseClient.auth.onAuthStateChange(() => refresh());
      const prev = cleanupRealtime;
      cleanupRealtime = () => {
        prev?.();
        sub.subscription.unsubscribe();
      };
    }

    return () => {
      cleanupRealtime?.();
    };
  }, [refresh]);

  const consume = useCallback(
    async (action: CreditAction): Promise<boolean> => {
      const ok = await creditsService.consume(action);
      if (!ok) {
        toast.error("Créditos insuficientes", {
          description: `${CREDIT_LABELS[action]} cuesta ${CREDIT_COSTS[action]} créditos.`,
        });
        return false;
      }
      refresh();
      return true;
    },
    [refresh],
  );

  return { balance, unlimited, loading, consume, refresh };
}