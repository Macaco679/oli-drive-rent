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
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
}

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
  // Convert all photos to base64
  const images: Record<string, string> = {};
  for (const slot of INSPECTION_PHOTO_SLOTS) {
    const state = params.photos[slot.id];
    if (state?.file) {
      images[slot.id] = await fileToBase64(state.file);
    }
  }

  const extraImagesBase64: string[] = [];
  for (const ep of params.extraPhotos) {
    extraImagesBase64.push(await fileToBase64(ep.file));
  }

  // Build full JSON payload with images included
  const payload = {
    _webhook_target: "oli-vistoria",
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
    images,
    extra_images: extraImagesBase64.length > 0 ? extraImagesBase64 : null,
  };

  // Send as JSON via edge function
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/webhook-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
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
