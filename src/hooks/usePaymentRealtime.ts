import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus = "pending" | "paid" | "confirmed" | "received" | "receveid" | "failed" | "refunded" | null;

/**
 * Hook that fetches the latest payment status for a rental,
 * with realtime subscription for instant updates.
 */
export function usePaymentRealtime(rentalId: string | undefined) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(null);
  const [loading, setLoading] = useState(true);

  const hasPaid = paymentStatus === "paid" || paymentStatus === "confirmed" || paymentStatus === "received" || paymentStatus === "receveid";

  const fetchPaymentStatus = useCallback(async () => {
    if (!rentalId) {
      setPaymentStatus(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("oli_payments")
      .select("status")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setPaymentStatus(data[0].status as PaymentStatus);
    } else {
      setPaymentStatus(null);
    }
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

  return { paymentStatus, hasPaid, loading };
}
