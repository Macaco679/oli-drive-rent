import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface InspectionRecord {
  id: string;
  rental_id: string;
  vehicle_id: string;
  performed_by: string;
  inspection_kind: "pickup" | "dropoff";
  status: string;
  inspection_stage: string | null;
  validated_by_ai: boolean;
  validated_at: string | null;
  validation_summary: string | null;
  completed_at: string | null;
  owner_approved_at: string | null;
  renter_approved_at: string | null;
  created_at: string;
  notes: string | null;
}

/**
 * Hook that subscribes to real-time changes on oli_inspections for a given rental.
 */
export function useInspectionRealtime(rentalId: string | undefined) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInspections = useCallback(async () => {
    if (!rentalId) {
      setInspections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("oli_inspections")
      .select("*")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setInspections(data as unknown as InspectionRecord[]);
    }
    setLoading(false);
  }, [rentalId]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  useEffect(() => {
    if (!rentalId) return;

    const channel = supabase
      .channel(`inspection-realtime-${rentalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oli_inspections",
          filter: `rental_id=eq.${rentalId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setInspections((prev) => [...prev, payload.new as unknown as InspectionRecord]);
          } else if (payload.eventType === "UPDATE" && payload.new) {
            setInspections((prev) =>
              prev.map((i) => (i.id === (payload.new as any).id ? (payload.new as unknown as InspectionRecord) : i))
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            setInspections((prev) => prev.filter((i) => i.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rentalId]);

  // Helper: find inspection by stage
  const getByStage = useCallback(
    (stage: string) => inspections.find((i) => i.inspection_stage === stage) || null,
    [inspections]
  );

  // Helper: find inspection by kind
  const getByKind = useCallback(
    (kind: "pickup" | "dropoff") => inspections.filter((i) => i.inspection_kind === kind),
    [inspections]
  );

  return { inspections, loading, refetch: fetchInspections, getByStage, getByKind };
}
