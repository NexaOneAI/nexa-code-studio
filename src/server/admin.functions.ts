/**
 * Server functions para el panel admin.
 * Validan rol admin en el backend usando la RPC has_role + service role
 * para evitar fugas RLS y permitir ver datos de todos los usuarios.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden: admin only");
}

const FiltersSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  email: z.string().trim().max(255).optional().nullable(),
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ search: z.string().trim().max(255).optional().nullable() })
      .parse(input ?? {})
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);

    let q = supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) {
      q = q.or(`email.ilike.%${data.search}%,display_name.ilike.%${data.search}%`);
    }
    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.user_id);
    if (ids.length === 0) return { users: [] };

    const [{ data: credits }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("credits").select("user_id, balance, unlimited").in("user_id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    const creditsMap = new Map(credits?.map((c) => [c.user_id, c]) ?? []);
    const rolesMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      rolesMap.set(r.user_id, arr);
    }

    return {
      users: (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        email: p.email,
        display_name: p.display_name,
        created_at: p.created_at,
        balance: creditsMap.get(p.user_id)?.balance ?? 0,
        unlimited: creditsMap.get(p.user_id)?.unlimited ?? false,
        roles: rolesMap.get(p.user_id) ?? [],
      })),
    };
  });

export const adminListPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FiltersSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);

    let userIds: string[] | null = null;
    if (data.email) {
      const { data: pf } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .ilike("email", `%${data.email}%`)
        .limit(50);
      userIds = (pf ?? []).map((p) => p.user_id);
      if (userIds.length === 0) return { purchases: [] };
    }

    let q = supabaseAdmin
      .from("credit_purchases")
      .select(
        "id, user_id, plan_name, credits, amount, currency, status, mercado_pago_payment_id, created_at, processed_at"
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (userIds) q = q.in("user_id", userIds);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .in("user_id", ids);
    const emailMap = new Map(profiles?.map((p) => [p.user_id, p.email]) ?? []);

    return {
      purchases: (rows ?? []).map((r) => ({ ...r, email: emailMap.get(r.user_id) ?? null })),
    };
  });

export const adminListTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FiltersSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);

    let userIds: string[] | null = null;
    if (data.email) {
      const { data: pf } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .ilike("email", `%${data.email}%`)
        .limit(50);
      userIds = (pf ?? []).map((p) => p.user_id);
      if (userIds.length === 0) return { transactions: [] };
    }

    let q = supabaseAdmin
      .from("credit_transactions")
      .select("id, user_id, amount, reason, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 300);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (userIds) q = q.in("user_id", userIds);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .in("user_id", ids);
    const emailMap = new Map(profiles?.map((p) => [p.user_id, p.email]) ?? []);

    return {
      transactions: (rows ?? []).map((r) => ({
        ...r,
        email: emailMap.get(r.user_id) ?? null,
      })),
    };
  });

export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);

    const [{ count: usersCount }, { count: approvedCount }, { count: pendingCount }, { data: approvedRows }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("credit_purchases")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved"),
        supabaseAdmin
          .from("credit_purchases")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseAdmin
          .from("credit_purchases")
          .select("amount, credits")
          .eq("status", "approved"),
      ]);

    const revenue = (approvedRows ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0
    );
    const creditsSold = (approvedRows ?? []).reduce(
      (s, r) => s + Number(r.credits ?? 0),
      0
    );

    return {
      users: usersCount ?? 0,
      approved: approvedCount ?? 0,
      pending: pendingCount ?? 0,
      revenue,
      credits_sold: creditsSold,
    };
  });