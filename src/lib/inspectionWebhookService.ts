import { supabase } from "@/integrations/supabase/client";
import {
  InspectionStep,
  InspectionFormData,
  INSPECTION_PHOTO_SLOTS,
  PhotoState,
  WebhookResponse,
} from "@/lib/inspectionTypes";

/**
 * Sends inspection data and photos to the oli-vistoria webhook via multipart/form-data.
 * The real image files are sent as form fields so n8n receives the binary data.
 */
export async function submitInspectionToWebhook(params: {
  rentalId: string;
  contractId?: string;
  contractNumber?: string;
  vehicleId: string;
  ownerId: string;
  renterId: string;
  inspectionStep: InspectionStep;
  performedByRole: "owner" | "renter";
  performedByUserId: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleBrand?: string;
  formData: InspectionFormData;
  photos: Record<string, PhotoState>;
  extraPhotos: Array<{ file: File; preview: string }>;
}): Promise<WebhookResponse> {
  const formData = new FormData();

  // Add the routing target
  formData.append("_webhook_target", "oli-vistoria");

  // Build JSON payload
  const payload = {
    rental_id: params.rentalId,
    contract_id: params.contractId || null,
    contract_number: params.contractNumber || null,
    vehicle_id: params.vehicleId,
    owner_id: params.ownerId,
    renter_id: params.renterId,
    inspection_step: params.inspectionStep,
    performed_by_role: params.performedByRole,
    performed_by_user_id: params.performedByUserId,
    performed_at: new Date().toISOString(),
    vehicle_plate: params.vehiclePlate || null,
    vehicle_model: params.vehicleModel || null,
    vehicle_brand: params.vehicleBrand || null,
    mileage: params.formData.mileage,
    fuel_level: params.formData.fuel_level,
    clean: params.formData.is_clean,
    has_visible_damage: params.formData.has_visible_damage,
    damage_notes: params.formData.damage_notes || null,
    notes: params.formData.notes || null,
    checklist: params.formData.checklist,
    source: "lovable_frontend",
  };

  formData.append("payload", JSON.stringify(payload));

  // Append mandatory photo files
  for (const slot of INSPECTION_PHOTO_SLOTS) {
    const state = params.photos[slot.id];
    if (state?.file) {
      formData.append(slot.id, state.file, `${slot.id}.${state.file.name.split(".").pop() || "jpg"}`);
    }
  }

  // Append extra photos
  params.extraPhotos.forEach((ep, idx) => {
    formData.append(`extra_images`, ep.file, `extra_${idx}.${ep.file.name.split(".").pop() || "jpg"}`);
  });

  // Send via edge function
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/webhook-proxy`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      apikey: anonKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OLI Vistoria] Webhook error:", errorText);
    throw new Error(`Erro no envio: ${response.status}`);
  }

  let result = await response.json();

  // Normalize n8n response
  if (Array.isArray(result)) result = result[0];
  if (result?.output && typeof result.output === "string") {
    try {
      result = { ...result, ...JSON.parse(result.output) };
    } catch {
      // ignore
    }
  }

  return {
    ok: result?.ok ?? true,
    inspection_id: result?.inspection_id,
    inspection_step: result?.inspection_step,
    status: result?.status,
    ai_status: result?.ai_status,
    approved: result?.approved ?? true,
    message: result?.message,
    failed_photos: result?.failed_photos || [],
    photo_analysis: result?.photo_analysis || [],
    next_step: result?.next_step,
    reservation_status: result?.reservation_status,
    contract_status: result?.contract_status,
  };
}
