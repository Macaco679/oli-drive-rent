import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentStatus } from "@/hooks/usePaymentRealtime";

export interface DepositPaymentRecord {
  id: string;
  amount: number;
  status: PaymentStatus;
  payment_link: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_copy_paste: string | null;
  pix_qr_code: string | null;
  provider_payment_id: string | null;
  external_reference: string | null;
  due_date: string | null;
  method: string | null;
  billingType: string | null;
  status_detail: string | null;
}

export function useDepositRealtime(rentalId: string | undefined, enabled = true) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(null);
  const [payment, setPayment] = useState<DepositPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const hasPaid =
    paymentStatus === "paid" ||
    paymentStatus === "confirmed" ||
    paymentStatus === "received" ||
    paymentStatus === "receveid";

  const fetchDepositStatus = useCallback(async () => {
    if (!rentalId || !enabled) {
      setPaymentStatus(null);
      setPayment(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("oli_payments")
      .select(
        "id, amount, status, payment_link, invoice_url, bank_slip_url, pix_copy_paste, pix_qr_code, provider_payment_id, external_reference, due_date, method, billingType, status_detail",
      )
      .eq("rental_id", rentalId)
      .eq("payment_type", "deposit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const rawStatus = String(data.status ?? "").toLowerCase().trim();
      setPaymentStatus((rawStatus || null) as PaymentStatus);
      setPayment({
        id: data.id,
        amount: data.amount,
        status: (rawStatus || null) as PaymentStatus,
        payment_link: data.payment_link,
        invoice_url: data.invoice_url,
        bank_slip_url: data.bank_slip_url,
        pix_copy_paste: data.pix_copy_paste,
        pix_qr_code: data.pix_qr_code,
        provider_payment_id: data.provider_payment_id,
        external_reference: data.external_reference,
        due_date: data.due_date,
        method: data.method,
        billingType: data.billingType,
        status_detail: data.status_detail,
      });
    } else {
      setPaymentStatus(null);
      setPayment(null);
    }

    setLoading(false);
  }, [enabled, rentalId]);

  useEffect(() => {
    fetchDepositStatus();
  }, [fetchDepositStatus]);

  useEffect(() => {
    if (!rentalId || !enabled) return;

    const channel = supabase
      .channel(`deposit-realtime-${rentalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oli_payments",
          filter: `rental_id=eq.${rentalId}`,
        },
        () => {
          fetchDepositStatus();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchDepositStatus, rentalId]);

  return { paymentStatus, payment, hasPaid, loading, refetch: fetchDepositStatus };
}
