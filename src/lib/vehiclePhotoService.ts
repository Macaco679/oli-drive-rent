import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://sgpktbljjlixmyjmhppa.supabase.co";
const BUCKET_NAME = "vehicle-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  image_url: string;
  is_cover: boolean;
  created_at: string;
}

export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file before upload
 */
export function validatePhoto(file: File): PhotoValidationResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Formato inválido. Use JPG, PNG ou WebP.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "Arquivo muito grande. Máximo 5MB.",
    };
  }

  return { valid: true };
}

/**
 * Generates the storage path for a vehicle photo
 * Format: {vehicle_id}/{timestamp}-{original_name}
 */
function generateStoragePath(vehicleId: string, fileName: string): string {
  const timestamp = Date.now();
  // Sanitize filename - remove special chars except dots and dashes
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${vehicleId}/${timestamp}-${sanitizedName}`;
}

/**
 * Generates the public URL for a stored photo
 */
function getPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
}

/**
 * Extracts the storage path from a public URL
 */
export function extractPathFromUrl(imageUrl: string): string | null {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`;
  if (imageUrl.startsWith(prefix)) {
    return imageUrl.slice(prefix.length);
  }
  return null;
}

/**
 * Uploads a photo to Storage and creates a record in oli_vehicle_photos
 */
export async function uploadVehiclePhoto(
  vehicleId: string,
  file: File,
  isCover: boolean = false
): Promise<VehiclePhoto | null> {
  // Validate file
  const validation = validatePhoto(file);
  if (!validation.valid) {
    console.error("Validation failed:", validation.error);
    return null;
  }

  // Generate path
  const path = generateStoragePath(vehicleId, file.name);

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading photo:", uploadError);
    return null;
  }

  // Generate public URL
  const publicUrl = getPublicUrl(path);

  // Insert record in database
  const { data, error: dbError } = await supabase
    .from("oli_vehicle_photos")
    .insert({
      vehicle_id: vehicleId,
      image_url: publicUrl,
      is_cover: isCover,
    })
    .select()
    .single();

  if (dbError) {
    console.error("Error saving photo record:", dbError);
    // Try to clean up the uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([path]);
    return null;
  }

  return data as VehiclePhoto;
}

/**
 * Gets all photos for a vehicle, ordered by cover first, then by created_at desc
 */
export async function getVehiclePhotos(vehicleId: string): Promise<VehiclePhoto[]> {
  const { data, error } = await supabase
    .from("oli_vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("is_cover", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching vehicle photos:", error);
    return [];
  }

  return data as VehiclePhoto[];
}

/**
 * Sets a photo as the cover image for a vehicle
 * First removes cover from all other photos, then sets the new cover
 */
export async function setPhotoCover(
  vehicleId: string,
  photoId: string
): Promise<boolean> {
  // Remove cover from all photos of this vehicle
  const { error: resetError } = await supabase
    .from("oli_vehicle_photos")
    .update({ is_cover: false })
    .eq("vehicle_id", vehicleId);

  if (resetError) {
    console.error("Error resetting covers:", resetError);
    return false;
  }

  // Set the new cover
  const { error: setCoverError } = await supabase
    .from("oli_vehicle_photos")
    .update({ is_cover: true })
    .eq("id", photoId);

  if (setCoverError) {
    console.error("Error setting cover:", setCoverError);
    return false;
  }

  return true;
}

/**
 * Deletes a photo from Storage and the database
 */
export async function deleteVehiclePhoto(
  photoId: string,
  imageUrl: string
): Promise<boolean> {
  // Extract path from URL
  const path = extractPathFromUrl(imageUrl);
  
  // Delete from Storage if path was found
  if (path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue to delete database record anyway
    }
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from("oli_vehicle_photos")
    .delete()
    .eq("id", photoId);

  if (dbError) {
    console.error("Error deleting photo record:", dbError);
    return false;
  }

  return true;
}

/**
 * Deletes all photos for a vehicle
 */
export async function deleteAllVehiclePhotos(vehicleId: string): Promise<boolean> {
  // Get all photos for the vehicle
  const photos = await getVehiclePhotos(vehicleId);
  
  if (photos.length === 0) return true;

  // Extract paths and delete from storage
  const paths = photos
    .map((p) => extractPathFromUrl(p.image_url))
    .filter((p): p is string => p !== null);

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET_NAME).remove(paths);
  }

  // Delete all records from database
  const { error } = await supabase
    .from("oli_vehicle_photos")
    .delete()
    .eq("vehicle_id", vehicleId);

  if (error) {
    console.error("Error deleting photo records:", error);
    return false;
  }

  return true;
}
