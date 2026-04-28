import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_COSTS, CreditAction, CREDIT_LABELS } from "@/lib/credit-costs";
import { toast } from "sonner";

export function useCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [unlimited, setUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("credits").select("balance, unlimited").eq("user_id", user.id).maybeSingle();
    if (data) {
      setBalance(data.balance);
      setUnlimited(data.unlimited);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCredits();
    if (!user) return;
    const ch = supabase
      .channel("credits-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "credits", filter: `user_id=eq.${user.id}` }, fetchCredits)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchCredits]);

  const consume = useCallback(async (action: CreditAction): Promise<boolean> => {
    const amount = CREDIT_COSTS[action];
    if (!unlimited && balance < amount) {
      toast.error(`Créditos insuficientes`, { description: `${CREDIT_LABELS[action]} cuesta ${amount} créditos. Tienes ${balance}.` });
      return false;
    }
    const { data, error } = await supabase.rpc("consume_credits", { _amount: amount, _reason: CREDIT_LABELS[action] });
    if (error || !data) {
      toast.error("No se pudo consumir créditos");
      return false;
    }
    await fetchCredits();
    return true;
  }, [balance, unlimited, fetchCredits]);

  return { balance, unlimited, loading, consume, refresh: fetchCredits };
}