import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that checks if a rental has a paid payment record in oli_payments,
 * with realtime subscription for instant updates.
 */
export function usePaymentRealtime(rentalId: string | undefined) {
  const [hasPaid, setHasPaid] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPaymentStatus = useCallback(async () => {
    if (!rentalId) {
      setHasPaid(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("oli_payments")
      .select("id")
      .eq("rental_id", rentalId)
      .eq("status", "paid")
      .limit(1);

    setHasPaid(!!data && data.length > 0);
    setLoading(false);
  }, [rentalId]);

  useEffect(() => {
    fetchPaymentStatus();
  }, [fetchPaymentStatus]);

  useEffect(() => {
    if (!rentalId) return;

    const channel = supabase
      .channel(`payment-realtime-${rentalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oli_payments",
          filter: `rental_id=eq.${rentalId}`,
        },
        () => {
          fetchPaymentStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rentalId, fetchPaymentStatus]);

  return { hasPaid, loading };
}
