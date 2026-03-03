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

export async function submitInspectionToWebhook(params: {
  inspectionId: string;
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
  vehicleYear?: number;
  vehicleColor?: string;
  formData: InspectionFormData;
  photos: Record<string, PhotoState>;
  extraPhotos: Array<{ file: File; preview: string }>;
}): Promise<WebhookResponse> {
  const inspectionId = (params.inspectionId || "").trim();

  if (!inspectionId) {
    throw new Error("inspection_id obrigatório para envio da vistoria");
  }

  // ── Fetch owner & renter profiles for enrichment ──
  const [ownerRes, renterRes] = await Promise.all([
    supabase.from("oli_profiles").select("full_name, cpf, rg, email, phone, whatsapp_phone, birth_date, nationality, marital_status, profession").eq("id", params.ownerId).maybeSingle(),
    supabase.from("oli_profiles").select("full_name, cpf, rg, email, phone, whatsapp_phone, birth_date, nationality, marital_status, profession").eq("id", params.renterId).maybeSingle(),
  ]);
  const ownerProfile = ownerRes.data;
  const renterProfile = renterRes.data;

  const form = new FormData();

  // Routing field for the proxy
  form.append("_webhook_target", "oli-vistoria");

  const payload = {
    inspection_id: inspectionId,
    rental_id: params.rentalId,
    vehicle_id: params.vehicleId,
    contract_id: params.contractId || "",
    contract_number: params.contractNumber || "",
    owner_id: params.ownerId,
    renter_id: params.renterId,
    performed_by_user_id: params.performedByUserId,
    actor_role: params.performedByRole,
    inspection_step: params.inspectionStep,
    mileage: params.formData.mileage,
    fuel_level: params.formData.fuel_level,
    checklist: params.formData.checklist,
    performed_at: new Date().toISOString(),
    vehicle_plate: params.vehiclePlate || "",
    vehicle_model: params.vehicleModel || "",
    vehicle_brand: params.vehicleBrand || "",
    vehicle_year: String(params.vehicleYear || ""),
    vehicle_color: params.vehicleColor || "",
    clean: params.formData.is_clean,
    has_visible_damage: params.formData.has_visible_damage,
    damage_notes: params.formData.damage_notes || "",
    notes: params.formData.notes || "",
    source: "lovable_frontend",
    owner_name: ownerProfile?.full_name || "",
    owner_cpf: ownerProfile?.cpf || "",
    owner_rg: ownerProfile?.rg || "",
    owner_email: ownerProfile?.email || "",
    owner_phone: ownerProfile?.phone || "",
    owner_whatsapp: ownerProfile?.whatsapp_phone || "",
    owner_birth_date: ownerProfile?.birth_date || "",
    owner_nationality: ownerProfile?.nationality || "",
    owner_marital_status: ownerProfile?.marital_status || "",
    owner_profession: ownerProfile?.profession || "",
    renter_name: renterProfile?.full_name || "",
    renter_cpf: renterProfile?.cpf || "",
    renter_rg: renterProfile?.rg || "",
    renter_email: renterProfile?.email || "",
    renter_phone: renterProfile?.phone || "",
    renter_whatsapp: renterProfile?.whatsapp_phone || "",
    renter_birth_date: renterProfile?.birth_date || "",
    renter_nationality: renterProfile?.nationality || "",
    renter_marital_status: renterProfile?.marital_status || "",
    renter_profession: renterProfile?.profession || "",
  };

  // Redundância obrigatória
  form.append("payload", JSON.stringify({ ...payload, inspection_id: inspectionId }));
  form.append("inspection_id", inspectionId);

  // Mantém campos individuais (compatibilidade com workflows existentes)
  for (const [key, value] of Object.entries(payload)) {
    if (key === "inspection_id") continue;
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  }

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

  console.log("inspection_id", inspectionId);
  for (const [k, v] of form.entries()) {
    if (v instanceof File) {
      console.log(k, `[File ${v.name}]`);
    } else {
      console.log(k, v);
    }
  }

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
