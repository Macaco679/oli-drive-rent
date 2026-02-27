// ============================================================
// VEHICLE INSPECTION SERVICE - Upload de 10 fotos obrigatórias + validação IA
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export interface InspectionPhotoType {
  id: string;
  label: string;
  description: string;
}

export const INSPECTION_PHOTO_TYPES: InspectionPhotoType[] = [
  { id: "front", label: "Frente do veículo", description: "Vista frontal completa do veículo" },
  { id: "back", label: "Traseira do veículo", description: "Vista traseira completa do veículo" },
  { id: "left_side", label: "Lateral esquerda", description: "Vista lateral esquerda completa" },
  { id: "right_side", label: "Lateral direita", description: "Vista lateral direita completa" },
  { id: "dashboard_odometer", label: "Painel com quilometragem", description: "Painel com quilometragem e combustível visíveis" },
  { id: "interior_front", label: "Interior dianteiro", description: "Painel, volante e bancos dianteiros" },
  { id: "rear_seat", label: "Banco traseiro", description: "Vista dos bancos traseiros" },
  { id: "trunk_open", label: "Porta-malas aberto", description: "Interior do porta-malas aberto" },
  { id: "tire_front_left", label: "Pneu dianteiro esquerdo", description: "Estado do pneu dianteiro esquerdo" },
  { id: "tire_front_right", label: "Pneu dianteiro direito", description: "Estado do pneu dianteiro direito" },
];

export type InspectionStatus = "draft" | "pending_validation" | "validated" | "rejected" | "completed";
export type PhotoValidationStatus = "pending" | "approved" | "rejected";

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  image_url: string;
  description: string | null;
  has_damage: boolean;
  created_at: string;
  photo_type: string | null;
  sort_order: number;
  validation_status: string;
  validation_reason: string | null;
  validation_confidence: number | null;
  ai_labels: unknown | null;
  ai_damage_detected: boolean;
  uploaded_by: string | null;
  metadata: unknown | null;
}

export interface Inspection {
  id: string;
  rental_id: string;
  vehicle_id: string;
  performed_by: string;
  inspection_kind: "pickup" | "dropoff";
  side: string;
  notes: string | null;
  created_at: string;
  status: string;
  inspection_stage: string | null;
  required_photos_count: number;
  validated_by_ai: boolean;
  validated_at: string | null;
  validation_summary: string | null;
  completed_at: string | null;
}

// Validate photo file
export function validateInspectionPhoto(file: File): { valid: boolean; error?: string } {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "Formato inválido. Use JPG, PNG ou WebP." };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "Arquivo muito grande. Máximo 10MB." };
  }

  return { valid: true };
}

// Upload single inspection photo to storage
export async function uploadInspectionPhoto(
  userId: string,
  rentalId: string,
  photoTypeId: string,
  file: File
): Promise<string | null> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${userId}/${rentalId}/${photoTypeId}-${timestamp}.${ext}`;

  const { error } = await supabase.storage
    .from("inspection-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Erro ao fazer upload da foto de vistoria:", error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("inspection-photos")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// Validate inspection photos via AI (n8n webhook)
export async function validateInspectionPhotosViaAI(params: {
  rentalId: string;
  vehicleId: string;
  inspectionKind: "pickup" | "dropoff";
  inspectionStage: string;
  performedBy: string;
  photos: Array<{ photo_type: string; image_url: string; sort_order: number }>;
  notes?: string;
}): Promise<{
  approved: boolean;
  results: Array<{
    photo_type: string;
    status: "approved" | "rejected";
    reason?: string;
    confidence?: number;
    labels?: string[];
    damage_detected?: boolean;
  }>;
  summary?: string;
} | null> {
  try {
    const payload = {
      _webhook_target: "oli-vistoria-validar",
      rental_id: params.rentalId,
      vehicle_id: params.vehicleId,
      inspection_kind: params.inspectionKind,
      inspection_stage: params.inspectionStage,
      performed_by: params.performedBy,
      photos: params.photos,
      notes: params.notes || null,
      timestamp: new Date().toISOString(),
      source: "lovable_frontend",
    };

    console.log("[OLI Vistoria] Enviando para validação IA:", payload);

    const { data, error } = await supabase.functions.invoke("webhook-proxy", {
      body: payload,
    });

    if (error) {
      console.error("[OLI Vistoria] Erro na validação IA:", error);
      return null;
    }

    console.log("[OLI Vistoria] Resposta IA:", data);

    // Parse n8n response
    let result = data;
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch {
        console.warn("[OLI Vistoria] Não foi possível parsear resposta:", result);
        return null;
      }
    }
    if (Array.isArray(result)) result = result[0];
    if (result?.output && typeof result.output === "string") {
      try {
        result = { ...result, ...JSON.parse(result.output) };
      } catch {
        // ignore
      }
    }

    return {
      approved: result?.approved === true,
      results: result?.results || result?.photos_validation || [],
      summary: result?.summary || result?.validation_summary || null,
    };
  } catch (err) {
    console.error("[OLI Vistoria] Erro:", err);
    return null;
  }
}

// Create inspection record with all photos (after AI validation)
export async function createInspection(params: {
  rentalId: string;
  vehicleId: string;
  performedBy: string;
  kind: "pickup" | "dropoff";
  photos: Array<{ photoTypeId: string; url: string; hasDamage?: boolean; sortOrder?: number }>;
  notes?: string;
  status?: InspectionStatus;
  validatedByAi?: boolean;
  validationSummary?: string;
  photoValidations?: Array<{
    photo_type: string;
    status: string;
    reason?: string;
    confidence?: number;
    labels?: string[];
    damage_detected?: boolean;
  }>;
}): Promise<Inspection | null> {
  const { rentalId, vehicleId, performedBy, kind, photos, notes, status, validatedByAi, validationSummary, photoValidations } = params;

  const inspectionStatus = status || "draft";

  const { data: inspection, error: inspError } = await supabase
    .from("oli_inspections")
    .insert({
      rental_id: rentalId,
      vehicle_id: vehicleId,
      performed_by: performedBy,
      inspection_kind: kind,
      side: "front",
      notes: notes || null,
      status: inspectionStatus,
      required_photos_count: INSPECTION_PHOTO_TYPES.length,
      validated_by_ai: validatedByAi || false,
      validated_at: validatedByAi ? new Date().toISOString() : null,
      validation_summary: validationSummary || null,
      completed_at: inspectionStatus === "completed" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (inspError || !inspection) {
    console.error("Erro ao criar vistoria:", inspError);
    return null;
  }

  // Build photo records with validation data
  const photoRecords = photos.map((p, idx) => {
    const validationData = photoValidations?.find((v) => v.photo_type === p.photoTypeId);
    return {
      inspection_id: inspection.id,
      image_url: p.url,
      description: INSPECTION_PHOTO_TYPES.find((t) => t.id === p.photoTypeId)?.label || p.photoTypeId,
      has_damage: validationData?.damage_detected ?? p.hasDamage ?? false,
      photo_type: p.photoTypeId,
      sort_order: p.sortOrder ?? idx,
      validation_status: validationData?.status || "pending",
      validation_reason: validationData?.reason || null,
      validation_confidence: validationData?.confidence || null,
      ai_labels: validationData?.labels ? JSON.stringify(validationData.labels) : null,
      ai_damage_detected: validationData?.damage_detected || false,
      uploaded_by: performedBy,
    };
  });

  const { error: photoError } = await supabase
    .from("oli_inspection_photos")
    .insert(photoRecords);

  if (photoError) {
    console.error("Erro ao salvar fotos da vistoria:", photoError);
  }

  return inspection as unknown as Inspection;
}

// Get inspection for a rental
export async function getInspectionByRental(
  rentalId: string,
  kind: "pickup" | "dropoff"
): Promise<{ inspection: Inspection; photos: InspectionPhoto[] } | null> {
  const { data: inspection, error } = await supabase
    .from("oli_inspections")
    .select("*")
    .eq("rental_id", rentalId)
    .eq("inspection_kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !inspection) {
    return null;
  }

  const { data: photos } = await supabase
    .from("oli_inspection_photos")
    .select("*")
    .eq("inspection_id", inspection.id)
    .order("sort_order", { ascending: true });

  return {
    inspection: inspection as unknown as Inspection,
    photos: (photos || []) as unknown as InspectionPhoto[],
  };
}

// Check if inspection is complete for a rental
export async function hasCompleteInspection(
  rentalId: string,
  kind: "pickup" | "dropoff"
): Promise<boolean> {
  const result = await getInspectionByRental(rentalId, kind);
  if (!result) return false;

  // Check if we have all required photos and inspection is validated/completed
  const hasAllPhotos = result.photos.length >= INSPECTION_PHOTO_TYPES.length;
  const isValidated = result.inspection.status === "validated" || result.inspection.status === "completed";
  
  // For backwards compatibility, also check old inspections without status
  if (!result.inspection.status || result.inspection.status === "draft") {
    return hasAllPhotos;
  }
  
  return hasAllPhotos && isValidated;
}

// Get both inspections for comparison
export async function getInspectionsForComparison(
  rentalId: string
): Promise<{
  pickup: { inspection: Inspection; photos: InspectionPhoto[] } | null;
  dropoff: { inspection: Inspection; photos: InspectionPhoto[] } | null;
}> {
  const [pickup, dropoff] = await Promise.all([
    getInspectionByRental(rentalId, "pickup"),
    getInspectionByRental(rentalId, "dropoff"),
  ]);

  return { pickup, dropoff };
}
