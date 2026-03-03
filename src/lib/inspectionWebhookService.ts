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
 * Each photo is sent as a real file field with the exact slot key.
 */

// Persistent inspection_id per rental+step (generated once, reused on retries)
const inspectionIdCache = new Map<string, string>();

function getOrCreateInspectionId(rentalId: string, step: InspectionStep): string {
  const cacheKey = `${rentalId}__${step}`;
  if (!inspectionIdCache.has(cacheKey)) {
    inspectionIdCache.set(cacheKey, crypto.randomUUID());
  }
  return inspectionIdCache.get(cacheKey)!;
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
  const inspectionId = getOrCreateInspectionId(params.rentalId, params.inspectionStep);

  const form = new FormData();

  // Routing field for the proxy
  form.append("_webhook_target", "oli-vistoria");

  // ── Text fields (mandatory) ──
  form.append("inspection_id", inspectionId);
  form.append("rental_id", params.rentalId);
  form.append("vehicle_id", params.vehicleId);
  form.append("contract_id", params.contractId || "");
  form.append("contract_number", params.contractNumber || "");
  form.append("owner_id", params.ownerId);
  form.append("renter_id", params.renterId);
  form.append("performed_by_user_id", params.performedByUserId);
  form.append("actor_role", params.performedByRole);
  form.append("inspection_step", params.inspectionStep);
  form.append("mileage", params.formData.mileage);
  form.append("fuel_level", params.formData.fuel_level);
  form.append("checklist", JSON.stringify(params.formData.checklist));

  // Extra optional text fields
  form.append("performed_at", new Date().toISOString());
  form.append("vehicle_plate", params.vehiclePlate || "");
  form.append("vehicle_model", params.vehicleModel || "");
  form.append("vehicle_brand", params.vehicleBrand || "");
  form.append("clean", String(params.formData.is_clean));
  form.append("has_visible_damage", String(params.formData.has_visible_damage));
  form.append("damage_notes", params.formData.damage_notes || "");
  form.append("notes", params.formData.notes || "");
  form.append("source", "lovable_frontend");

  // ── File fields (exact keys) ──
  for (const slot of INSPECTION_PHOTO_SLOTS) {
    const state = params.photos[slot.id];
    if (state?.file) {
      form.append(slot.id, state.file, `${slot.id}.${getExtension(state.file)}`);
    }
  }

  // Extra photos
  params.extraPhotos.forEach((ep, idx) => {
    form.append(`extra_photo_${idx}`, ep.file, `extra_${idx}.${getExtension(ep.file)}`);
  });

  // ── Send via edge function proxy ──
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/webhook-proxy`, {
    method: "POST",
    headers: {
      // Do NOT set Content-Type – the browser sets it with the boundary automatically
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      apikey: anonKey,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[OLI Vistoria] Webhook error:", errorText);
    throw new Error(`Erro no envio: ${response.status}`);
  }

  let result = await response.json();

  // Normalize n8n response – may be array or have nested output
  if (Array.isArray(result)) result = result[0];
  if (result?.output && typeof result.output === "string") {
    try {
      result = { ...result, ...JSON.parse(result.output) };
    } catch {
      // ignore
    }
  }

  // Use lovable_payload if present
  const lp = result?.lovable_payload || result;

  return {
    ok: lp?.ok ?? true,
    inspection_id: lp?.inspection_id || inspectionId,
    inspection_step: lp?.inspection_step,
    status: lp?.status,
    ai_status: lp?.ai_status,
    approved: lp?.status === "approved" || (lp?.approved ?? true),
    message: lp?.message,
    failed_photos: lp?.needs_reupload || lp?.failed_photos || [],
    photo_analysis: lp?.photo_analysis || [],
    next_step: lp?.next_step,
    reservation_status: lp?.reservation_status,
    contract_status: lp?.contract_status,
  };
}

function getExtension(file: File): string {
  const name = file.name || "";
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}
