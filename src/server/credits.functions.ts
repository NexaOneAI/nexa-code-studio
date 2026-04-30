/**
 * Server functions para gestión de créditos del usuario autenticado.
 * - refundCreditsFn: devuelve créditos vía RPC `refund_credits` cuando una
 *   generación falla en validación frontend (post-respuesta del proveedor).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RefundSchema = z.object({
  amount: z.number().int().min(1).max(50),
  reason: z.string().min(1).max(160),
});

export const refundCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RefundSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: ok, error } = await supabase.rpc("refund_credits", {
      _amount: data.amount,
      _reason: data.reason,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: ok === true, refunded: ok === true ? data.amount : 0 };
  });