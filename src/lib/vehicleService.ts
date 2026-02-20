import { supabase } from "@/integrations/supabase/client";

// Re-export from vehiclePhotoService for convenience
export {
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  setPhotoCover,
  getVehiclePhotos,
  deleteAllVehiclePhotos,
  validatePhoto,
  type VehiclePhoto,
} from "./vehiclePhotoService";

export type VehicleType = "car" | "motorcycle" | "truck" | "van";

export interface VehicleFormData {
  vehicle_type: VehicleType;
  title: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate?: string;
  renavam?: string;
  fuel_type: string;
  transmission: "manual" | "automatic";
  seats: number;
  location_city: string;
  location_state: string;
  pickup_neighborhood?: string;
  pickup_street?: string;
  pickup_number?: string;
  pickup_complement?: string;
  pickup_zip_code?: string;
  daily_price: number;
  weekly_price?: number;
  monthly_price?: number;
  deposit_amount?: number;
  body_type?: string;
  segment?: string;
  is_popular?: boolean;
}

export async function createVehicle(data: VehicleFormData): Promise<{ id: string } | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    return null;
  }

  // Map vehicle_type to the database enum values
  const vehicleTypeMap: Record<VehicleType, string> = {
    car: "carro",
    motorcycle: "moto",
    truck: "caminhonete",
    van: "van",
  };

  const { data: vehicle, error } = await supabase
    .from("oli_vehicles")
    .insert({
      owner_id: userData.user.id,
      vehicle_type: vehicleTypeMap[data.vehicle_type] as any,
      title: data.title,
      brand: data.brand,
      model: data.model,
      year: data.year,
      color: data.color,
      plate: data.plate || null,
      renavam: data.renavam || null,
      fuel_type: data.fuel_type,
      transmission: data.transmission,
      seats: data.seats,
      location_city: data.location_city,
      location_state: data.location_state,
      pickup_neighborhood: data.pickup_neighborhood || null,
      pickup_street: data.pickup_street || null,
      pickup_number: data.pickup_number || null,
      pickup_complement: data.pickup_complement || null,
      pickup_zip_code: data.pickup_zip_code || null,
      daily_price: data.daily_price,
      weekly_price: data.weekly_price || null,
      monthly_price: data.monthly_price || null,
      deposit_amount: data.deposit_amount || null,
      body_type: (data.body_type as any) || null,
      segment: (data.segment as any) || null,
      is_popular: data.is_popular || false,
      status: "available" as const,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating vehicle:", error);
    return null;
  }

  return vehicle;
}

// Legacy function removed - use uploadVehiclePhoto from vehiclePhotoService

export async function getMyVehicles(): Promise<any[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from("oli_vehicles")
    .select(`
      *,
      oli_vehicle_photos (
        id,
        image_url,
        is_cover
      )
    `)
    .eq("owner_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching vehicles:", error);
    return [];
  }

  return data || [];
}

export async function getVehicleById(vehicleId: string): Promise<any | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("oli_vehicles")
    .select(`
      *,
      oli_vehicle_photos (
        id,
        image_url,
        is_cover
      )
    `)
    .eq("id", vehicleId)
    .eq("owner_id", userData.user.id)
    .single();

  if (error) {
    console.error("Error fetching vehicle:", error);
    return null;
  }

  return data;
}

export async function updateVehicle(
  vehicleId: string,
  data: Partial<VehicleFormData>
): Promise<boolean> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    return false;
  }

  // Create update object with proper type casting for enums
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  
  // Copy fields with proper handling
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  const { error } = await supabase
    .from("oli_vehicles")
    .update(updateData)
    .eq("id", vehicleId)
    .eq("owner_id", userData.user.id);

  if (error) {
    console.error("Error updating vehicle:", error);
    return false;
  }

  return true;
}

export async function deleteVehicle(vehicleId: string): Promise<boolean> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    return false;
  }

  // Import and use the new photo service
  const { deleteAllVehiclePhotos } = await import("./vehiclePhotoService");
  await deleteAllVehiclePhotos(vehicleId);

  // Delete vehicle
  const { error } = await supabase
    .from("oli_vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("owner_id", userData.user.id);

  if (error) {
    console.error("Error deleting vehicle:", error);
    return false;
  }

  return true;
}
