import { useEffect, useState, useCallback } from "react";
import { CREDIT_COSTS, CreditAction, CREDIT_LABELS } from "@/lib/credit-costs";
import { toast } from "sonner";
import { localStore, subscribeStore } from "@/lib/local-store";

/**
 * Sistema de créditos 100% local (localStorage).
 * Backend Supabase queda preparado pero no se usa aquí para evitar romper en modo demo.
 */
export function useCredits() {
  const [balance, setBalance] = useState<number>(() => localStore.getCredits().balance);
  const [unlimited, setUnlimited] = useState<boolean>(() => localStore.getCredits().unlimited);

  const refresh = useCallback(() => {
    const c = localStore.getCredits();
    setBalance(c.balance);
    setUnlimited(c.unlimited);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeStore(refresh);
  }, [refresh]);

  const consume = useCallback(
    async (action: CreditAction): Promise<boolean> => {
      const amount = CREDIT_COSTS[action];
      const ok = localStore.consumeCredits(amount, CREDIT_LABELS[action]);
      if (!ok) {
        toast.error("Créditos insuficientes", {
          description: `${CREDIT_LABELS[action]} cuesta ${amount} créditos.`,
        });
        return false;
      }
      refresh();
      return true;
    },
    [refresh],
  );

  return { balance, unlimited, loading: false, consume, refresh };
}