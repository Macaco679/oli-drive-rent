import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RentalContract, getContractByRentalId } from "@/lib/contractService";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Hook that subscribes to real-time changes on oli_rental_contracts for a given rental.
 * Returns the latest contract and auto-updates when the DB row changes.
 */
export function useContractRealtime(rentalId: string | undefined) {
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  const fetchContract = useCallback(async () => {
    if (!rentalId) {
      setContract(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getContractByRentalId(rentalId);
    setContract(data);
    setLoading(false);
  }, [rentalId]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  // Realtime subscription
  useEffect(() => {
    if (!rentalId) return;

    const channel = supabase
      .channel(`contract-realtime-${rentalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oli_rental_contracts",
          filter: `rental_id=eq.${rentalId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
          if (payload.eventType === "DELETE") {
            setContract(null);
          } else if (payload.new) {
            setContract(payload.new as unknown as RentalContract);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rentalId]);

  return { contract, loading, refetch: fetchContract };
}
