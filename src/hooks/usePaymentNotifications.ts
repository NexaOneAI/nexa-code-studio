import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabaseClient } from "@/integrations/supabase/client";

const STORAGE_KEY = "nexa:seen-approved-purchases";

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(s: Set<string>) {
  try {
    // Mantener máximo 100 IDs
    const arr = Array.from(s).slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/**
 * Escucha en tiempo real las compras del usuario actual. Cuando una compra
 * pasa a `approved` (o se inserta ya aprobada vía webhook), muestra un toast
 * con enlace al historial de compras.
 *
 * Idempotente: cada purchase_id sólo dispara una notificación, persistida
 * en localStorage para sobrevivir recargas.
 */
export function usePaymentNotifications(opts: {
  onApproved?: (purchase: { id: string; credits: number; plan_name: string }) => void;
}) {
  const seenRef = useRef<Set<string>>(loadSeen());
  const onApprovedRef = useRef(opts.onApproved);
  onApprovedRef.current = opts.onApproved;

  useEffect(() => {
    if (!supabaseClient) return;
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      const { data } = await supabaseClient!.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;

      // 1. Al montar: detecta compras aprobadas recientes que aún no se hayan notificado
      //    (cubre el caso en que el webhook aprueba mientras el usuario estaba fuera).
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const { data: recent } = await supabaseClient!
        .from("credit_purchases")
        .select("id, plan_name, credits, status, processed_at")
        .eq("user_id", uid)
        .eq("status", "approved")
        .gte("processed_at", since)
        .order("processed_at", { ascending: false })
        .limit(5);

      for (const row of recent ?? []) {
        notifyOnce(row);
      }

      // 2. Realtime: dispara al insert/update con status=approved
      const ch = supabaseClient!
        .channel(`purchases-${uid}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "credit_purchases",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old) as
              | { id: string; status: string; credits: number; plan_name: string }
              | null;
            if (!row || row.status !== "approved") return;
            notifyOnce(row);
          },
        )
        .subscribe();

      cleanup = () => {
        supabaseClient!.removeChannel(ch);
      };
    };

    function notifyOnce(row: { id: string; plan_name: string; credits: number }) {
      if (seenRef.current.has(row.id)) return;
      seenRef.current.add(row.id);
      saveSeen(seenRef.current);
      onApprovedRef.current?.(row);
      toast.success("¡Pago aprobado!", {
        description: `Se acreditaron ${row.credits} créditos del plan ${row.plan_name}.`,
        duration: 8000,
        action: {
          label: "Ver historial",
          onClick: () => {
            window.location.href = "/credits";
          },
        },
      });
    }

    setup();
    return () => {
      cleanup?.();
    };
  }, []);
}