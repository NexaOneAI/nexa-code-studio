/**
 * Servicio de créditos: SIEMPRE consulta Supabase cuando hay sesión.
 * Si no hay sesión devuelve valores vacíos (las rutas privadas redirigen a /login antes).
 */
import { supabaseClient } from "@/integrations/supabase/client";
import { canUseSupabase } from "./backend";
import { CREDIT_LABELS, type CreditAction, CREDIT_COSTS } from "@/lib/credit-costs";

export const creditsService = {
  /** Mantenido por compatibilidad: ahora "local" significa simplemente "sin sesión". */
  async isLocal(): Promise<boolean> {
    return !(await canUseSupabase());
  },

  async getBalance(): Promise<{ balance: number; unlimited: boolean }> {
    if (!(await canUseSupabase())) return { balance: 0, unlimited: false };
    const { data: sess } = await supabaseClient!.auth.getSession();
    const uid = sess.session!.user.id;
    const { data } = await supabaseClient!
      .from("credits")
      .select("balance, unlimited")
      .eq("user_id", uid)
      .maybeSingle();
    return { balance: data?.balance ?? 0, unlimited: data?.unlimited ?? false };
  },

  async consume(action: CreditAction): Promise<boolean> {
    const amount = CREDIT_COSTS[action];
    const reason = CREDIT_LABELS[action];
    if (!(await canUseSupabase())) return false;
    const { data, error } = await supabaseClient!.rpc("consume_credits", {
      _amount: amount,
      _reason: reason,
    });
    if (error) return false;
    return Boolean(data);
  },

  async listTransactions() {
    if (!(await canUseSupabase())) return [];
    const { data } = await supabaseClient!
      .from("credit_transactions")
      .select("id,amount,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  },
};