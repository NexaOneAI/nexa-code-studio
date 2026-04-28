/**
 * Servicio de créditos: idéntica filosofía que projects.service.
 * Usa Supabase si hay sesión, si no cae al store local. Nunca rompe.
 */
import { localStore } from "@/lib/local-store";
import { supabaseClient } from "@/integrations/supabase/client";
import { canUseSupabase } from "./backend";
import { CREDIT_LABELS, type CreditAction, CREDIT_COSTS } from "@/lib/credit-costs";

export const creditsService = {
  /** True si la operación se está sirviendo desde el store local (sin sesión Supabase). */
  async isLocal(): Promise<boolean> {
    return !(await canUseSupabase());
  },

  async getBalance(): Promise<{ balance: number; unlimited: boolean }> {
    if (await canUseSupabase()) {
      const { data: sess } = await supabaseClient!.auth.getSession();
      const uid = sess.session!.user.id;
      const { data } = await supabaseClient!
        .from("credits")
        .select("balance, unlimited")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) return { balance: data.balance, unlimited: data.unlimited };
    }
    return localStore.getCredits();
  },

  async consume(action: CreditAction): Promise<boolean> {
    const amount = CREDIT_COSTS[action];
    const reason = CREDIT_LABELS[action];
    if (await canUseSupabase()) {
      const { data, error } = await supabaseClient!.rpc("consume_credits", {
        _amount: amount,
        _reason: reason,
      });
      if (error) return false;
      // Mantén el espejo local sincronizado (best effort).
      if (data) localStore.consumeCredits(amount, reason);
      return Boolean(data);
    }
    return localStore.consumeCredits(amount, reason);
  },

  async listTransactions() {
    if (await canUseSupabase()) {
      const { data } = await supabaseClient!
        .from("credit_transactions")
        .select("id,amount,reason,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) return data;
    }
    return localStore.listTransactions().slice(0, 50);
  },

  /** Sólo aplica en modo local. En Supabase los créditos se cargan vía pagos/admin. */
  addDemoLocal(amount: number, reason: string) {
    localStore.addCredits(amount, reason);
  },

  toggleUnlimitedLocal() {
    const c = localStore.getCredits();
    localStore.setUnlimited(!c.unlimited);
  },
};