import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OliVehiclePhoto } from "@/lib/supabase";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type PhotoPayload = RealtimePostgresChangesPayload<{
  [key: string]: any;
}>;

interface UseVehiclePhotosRealtimeOptions {
  /** If provided, only listen to changes for this vehicle */
  vehicleId?: string;
  /** Callback when a photo is inserted */
  onInsert?: (photo: OliVehiclePhoto) => void;
  /** Callback when a photo is updated */
  onUpdate?: (photo: OliVehiclePhoto) => void;
  /** Callback when a photo is deleted */
  onDelete?: (oldPhoto: { id: string; vehicle_id: string }) => void;
}

/**
 * Hook to subscribe to real-time changes on oli_vehicle_photos
 */
export function useVehiclePhotosRealtime({
  vehicleId,
  onInsert,
  onUpdate,
  onDelete,
}: UseVehiclePhotosRealtimeOptions) {
  const handleChange = useCallback(
    (payload: PhotoPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      if (eventType === "INSERT" && newRecord && onInsert) {
        // If filtering by vehicleId, check it matches
        if (vehicleId && newRecord.vehicle_id !== vehicleId) return;
        onInsert(newRecord as OliVehiclePhoto);
      }

      if (eventType === "UPDATE" && newRecord && onUpdate) {
        if (vehicleId && newRecord.vehicle_id !== vehicleId) return;
        onUpdate(newRecord as OliVehiclePhoto);
      }

      if (eventType === "DELETE" && oldRecord && onDelete) {
        if (vehicleId && oldRecord.vehicle_id !== vehicleId) return;
        onDelete({ id: oldRecord.id, vehicle_id: oldRecord.vehicle_id });
      }
    },
    [vehicleId, onInsert, onUpdate, onDelete]
  );

  useEffect(() => {
    // Build filter if vehicleId is provided
    const filter = vehicleId
      ? `vehicle_id=eq.${vehicleId}`
      : undefined;

    const channel = supabase
      .channel("vehicle-photos-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oli_vehicle_photos",
          ...(filter ? { filter } : {}),
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId, handleChange]);
}
