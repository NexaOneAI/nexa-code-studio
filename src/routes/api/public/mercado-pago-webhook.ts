/**
 * Webhook público de Mercado Pago.
 * Acepta notificaciones de tipo "payment", consulta el pago real con el access token,
 * y si está aprobado acredita los créditos al usuario de forma idempotente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type MPPayment = {
  id: number;
  status: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
};

async function processPayment(paymentId: string): Promise<Response> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[mp-webhook] Missing MERCADO_PAGO_ACCESS_TOKEN");
    return new Response("server misconfigured", { status: 500 });
  }

  // 1. Consultar el pago en Mercado Pago
  const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!mpResp.ok) {
    console.error("[mp-webhook] MP payment fetch failed", mpResp.status);
    // 200 to avoid endless retries on hard errors; MP retries on 5xx
    return new Response("payment fetch failed", { status: 200 });
  }
  const payment = (await mpResp.json()) as MPPayment;
  const purchaseId = payment.external_reference;
  if (!purchaseId) {
    console.warn("[mp-webhook] Missing external_reference for payment", paymentId);
    return new Response("ok", { status: 200 });
  }

  // 2. Buscar la compra
  const { data: purchase, error: purchaseErr } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, user_id, credits, plan_name, status")
    .eq("id", purchaseId)
    .maybeSingle();

  if (purchaseErr || !purchase) {
    console.error("[mp-webhook] Purchase not found", purchaseId, purchaseErr);
    return new Response("ok", { status: 200 });
  }

  // Idempotencia: si ya está aprobada, no hacer nada
  if (purchase.status === "approved") {
    return new Response("already processed", { status: 200 });
  }

  // 3. Manejar estados
  if (payment.status === "approved") {
    // Marcar approved (insert único por payment_id evita duplicado)
    const { error: updErr } = await supabaseAdmin
      .from("credit_purchases")
      .update({
        status: "approved",
        mercado_pago_payment_id: String(payment.id),
        processed_at: new Date().toISOString(),
      })
      .eq("id", purchase.id)
      .neq("status", "approved");

    if (updErr) {
      // Conflicto por unique index = ya procesado en otra notificación
      console.warn("[mp-webhook] update conflict (likely duplicate)", updErr.message);
      return new Response("duplicate", { status: 200 });
    }

    // Acreditar créditos
    const { data: existing } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", purchase.user_id)
      .maybeSingle();

    const newBalance = (existing?.balance ?? 0) + purchase.credits;
    const { error: creditErr } = await supabaseAdmin
      .from("credits")
      .upsert(
        { user_id: purchase.user_id, balance: newBalance },
        { onConflict: "user_id" }
      );

    if (creditErr) {
      console.error("[mp-webhook] Credit upsert failed", creditErr);
      return new Response("credit error", { status: 500 });
    }

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: purchase.user_id,
      amount: purchase.credits,
      reason: `Compra ${purchase.plan_name} (Mercado Pago)`,
      metadata: {
        purchase_id: purchase.id,
        payment_id: String(payment.id),
        provider: "mercado_pago",
      },
    });

    return new Response("approved", { status: 200 });
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await supabaseAdmin
      .from("credit_purchases")
      .update({
        status: "failed",
        mercado_pago_payment_id: String(payment.id),
      })
      .eq("id", purchase.id)
      .eq("status", "pending");
    return new Response("failed", { status: 200 });
  }

  // pending / in_process / authorized → mantener pending
  return new Response("pending", { status: 200 });
}

export const Route = createFileRoute("/api/public/mercado-pago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        // MP envía topic/type y data.id por query y/o body
        let paymentId: string | null =
          url.searchParams.get("data.id") ??
          url.searchParams.get("id") ??
          null;
        const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");

        try {
          const body = await request.json().catch(() => null);
          if (!paymentId && body && typeof body === "object") {
            const b = body as { data?: { id?: string | number }; type?: string };
            if (b.data?.id) paymentId = String(b.data.id);
          }
        } catch {
          // body puede estar vacío
        }

        if (topic && topic !== "payment") {
          // Ignorar merchant_order y otros tipos
          return new Response("ignored", { status: 200 });
        }

        if (!paymentId) {
          return new Response("no payment id", { status: 200 });
        }

        return processPayment(paymentId);
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});