// ============================================================
// VEHICLE INSPECTION SERVICE - Upload de 8 fotos obrigatórias
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export interface InspectionPhotoType {
  id: string;
  label: string;
  description: string;
}

export const INSPECTION_PHOTO_TYPES: InspectionPhotoType[] = [
  { id: "front", label: "Frente do Carro", description: "Vista frontal completa do veículo" },
  { id: "back", label: "Traseira do Carro", description: "Vista traseira completa do veículo" },
  { id: "interior_driver", label: "Interior (Motorista)", description: "Painel, volante e banco do motorista" },
  { id: "trunk_closed", label: "Porta-malas Fechado", description: "Porta-malas fechado" },
  { id: "trunk_open", label: "Porta-malas Aberto", description: "Interior do porta-malas" },
  { id: "tire_front_right", label: "Pneu Dianteiro Direito", description: "Estado do pneu dianteiro direito" },
  { id: "tire_front_left", label: "Pneu Dianteiro Esquerdo", description: "Estado do pneu dianteiro esquerdo" },
  { id: "rear_seat", label: "Banco de Trás", description: "Vista dos bancos traseiros" },
];

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  image_url: string;
  description: string | null;
  has_damage: boolean;
  created_at: string;
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

// Create inspection record with all photos
export async function createInspection(params: {
  rentalId: string;
  vehicleId: string;
  performedBy: string;
  kind: "pickup" | "dropoff";
  photos: Array<{ photoTypeId: string; url: string; hasDamage?: boolean }>;
  notes?: string;
}): Promise<Inspection | null> {
  const { rentalId, vehicleId, performedBy, kind, photos, notes } = params;

  // Create main inspection record (we use 'front' as default side)
  const { data: inspection, error: inspError } = await supabase
    .from("oli_inspections")
    .insert({
      rental_id: rentalId,
      vehicle_id: vehicleId,
      performed_by: performedBy,
      inspection_kind: kind,
      side: "front",
      notes: notes || null,
    })
    .select()
    .single();

  if (inspError || !inspection) {
    console.error("Erro ao criar vistoria:", inspError);
    return null;
  }

  // Create photo records
  const photoRecords = photos.map((p) => ({
    inspection_id: inspection.id,
    image_url: p.url,
    description: INSPECTION_PHOTO_TYPES.find((t) => t.id === p.photoTypeId)?.label || p.photoTypeId,
    has_damage: p.hasDamage || false,
  }));

  const { error: photoError } = await supabase
    .from("oli_inspection_photos")
    .insert(photoRecords);

  if (photoError) {
    console.error("Erro ao salvar fotos da vistoria:", photoError);
    // Inspection was created but photos failed - still return the inspection
  }

  return inspection as Inspection;
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
    .order("created_at", { ascending: true });

  return {
    inspection: inspection as Inspection,
    photos: (photos || []) as InspectionPhoto[],
  };
}

// Check if inspection is complete for a rental
export async function hasCompleteInspection(
  rentalId: string,
  kind: "pickup" | "dropoff"
): Promise<boolean> {
  const result = await getInspectionByRental(rentalId, kind);
  if (!result) return false;

  // Check if we have all 8 required photos
  return result.photos.length >= INSPECTION_PHOTO_TYPES.length;
}
