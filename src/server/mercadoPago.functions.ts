/**
 * Server function para crear una preferencia de Mercado Pago Checkout Pro.
 * - Valida usuario autenticado vía middleware.
 * - Crea registro pending en credit_purchases.
 * - Crea preference en Mercado Pago.
 * - Devuelve { payment_url, purchase_id }.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CREDIT_PLANS, type CreditPlanId } from "@/lib/credit-plans";

const InputSchema = z.object({
  plan_id: z.enum(["starter", "pro", "ultra"]),
});

export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const planId = data.plan_id as CreditPlanId;
    const plan = CREDIT_PLANS[planId];

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN no está configurado");
    }

    // Origen para back_urls y notification_url
    const req = getRequest();
    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;

    // 1. Crear compra pendiente
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("credit_purchases")
      .insert({
        user_id: userId,
        plan_name: plan.name,
        credits: plan.credits,
        amount: plan.price,
        currency: plan.currency,
        status: "pending",
      })
      .select("id")
      .single();

    if (purchaseError || !purchase) {
      console.error("Error creando compra:", purchaseError);
      throw new Error("No se pudo registrar la compra");
    }

    // 2. Crear preference en Mercado Pago
    const preferenceBody = {
      items: [
        {
          id: plan.id,
          title: `Nexa One — ${plan.name} (${plan.credits} créditos)`,
          description: plan.description,
          quantity: 1,
          unit_price: plan.price,
          currency_id: plan.currency,
        },
      ],
      external_reference: purchase.id,
      back_urls: {
        success: `${origin}/payment/success?purchase_id=${purchase.id}`,
        failure: `${origin}/payment/failure?purchase_id=${purchase.id}`,
        pending: `${origin}/payment/pending?purchase_id=${purchase.id}`,
      },
      auto_return: "approved",
      notification_url: `${origin}/api/public/mercado-pago-webhook`,
      metadata: {
        purchase_id: purchase.id,
        user_id: userId,
        plan_id: plan.id,
        credits: plan.credits,
      },
    };

    const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });

    if (!mpResp.ok) {
      const errText = await mpResp.text();
      console.error("Error MP preference:", mpResp.status, errText);
      await supabaseAdmin
        .from("credit_purchases")
        .update({ status: "failed" })
        .eq("id", purchase.id);
      throw new Error(`Error creando preferencia de pago (${mpResp.status})`);
    }

    const mpData = (await mpResp.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    };

    // 3. Guardar preference_id
    await supabaseAdmin
      .from("credit_purchases")
      .update({ mercado_pago_preference_id: mpData.id })
      .eq("id", purchase.id);

    const paymentUrl = mpData.init_point ?? mpData.sandbox_init_point;
    if (!paymentUrl) {
      throw new Error("Mercado Pago no devolvió URL de pago");
    }

    return {
      purchase_id: purchase.id,
      payment_url: paymentUrl,
      preference_id: mpData.id,
    };
  });

/**
 * Devuelve el estado actual de una compra (para la pantalla /payment/success).
 */
export const getPurchaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ purchase_id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { data: row, error } = await supabaseAdmin
      .from("credit_purchases")
      .select("id, status, plan_name, credits, amount, currency")
      .eq("id", data.purchase_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { purchase: row };
  });