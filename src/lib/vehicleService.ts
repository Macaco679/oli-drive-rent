import { supabase } from "@/integrations/supabase/client";

export interface VehicleFormData {
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

  const { data: vehicle, error } = await supabase
    .from("oli_vehicles")
    .insert({
      owner_id: userData.user.id,
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
      daily_price: data.daily_price,
      weekly_price: data.weekly_price || null,
      monthly_price: data.monthly_price || null,
      deposit_amount: data.deposit_amount || null,
      body_type: data.body_type || null,
      segment: data.segment || null,
      is_popular: data.is_popular || false,
      status: "available",
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

export async function uploadVehiclePhoto(
  vehicleId: string,
  file: File,
  isCover: boolean = false
): Promise<string | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    return null;
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;

  // Upload to vehicle-photos bucket
  const { error: uploadError } = await supabase.storage
    .from("vehicle-photos")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading photo:", uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("vehicle-photos")
    .getPublicUrl(fileName);

  // Save to oli_vehicle_photos table
  const { error: dbError } = await supabase
    .from("oli_vehicle_photos")
    .insert({
      vehicle_id: vehicleId,
      image_url: urlData.publicUrl,
      is_cover: isCover,
    });

  if (dbError) {
    console.error("Error saving photo reference:", dbError);
    return null;
  }

  return urlData.publicUrl;
}

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

  const { error } = await supabase
    .from("oli_vehicles")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
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

  // First delete photos from storage
  const { data: photos } = await supabase
    .from("oli_vehicle_photos")
    .select("image_url")
    .eq("vehicle_id", vehicleId);

  if (photos && photos.length > 0) {
    const filePaths = photos.map((p) => {
      const url = new URL(p.image_url);
      const path = url.pathname.split("/vehicle-photos/")[1];
      return path;
    }).filter(Boolean);

    if (filePaths.length > 0) {
      await supabase.storage.from("vehicle-photos").remove(filePaths);
    }
  }

  // Delete photo records
  await supabase
    .from("oli_vehicle_photos")
    .delete()
    .eq("vehicle_id", vehicleId);

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

export async function deleteVehiclePhoto(photoId: string, imageUrl: string): Promise<boolean> {
  try {
    // Delete from storage
    const url = new URL(imageUrl);
    const path = url.pathname.split("/vehicle-photos/")[1];
    if (path) {
      await supabase.storage.from("vehicle-photos").remove([path]);
    }

    // Delete from database
    const { error } = await supabase
      .from("oli_vehicle_photos")
      .delete()
      .eq("id", photoId);

    if (error) {
      console.error("Error deleting photo record:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting photo:", error);
    return false;
  }
}
