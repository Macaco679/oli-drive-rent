import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

export interface OliProfile {
  id: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  role: "renter" | "owner" | "both";
  created_at: string;
  updated_at: string;
}

export interface OliVehicle {
  id: string;
  owner_id: string;
  title: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  plate: string | null;
  renavam: string | null;
  transmission: string | null;
  fuel_type: string | null;
  seats: number | null;
  daily_price: number | null;
  weekly_price: number | null;
  monthly_price: number | null;
  deposit_amount: number | null;
  location_city: string | null;
  location_state: string | null;
  is_active: boolean;
  status: "available" | "unavailable" | "maintenance";
  created_at: string;
  updated_at: string;
}

export interface OliVehiclePhoto {
  id: string;
  vehicle_id: string;
  image_url: string;
  is_cover: boolean;
  created_at: string;
}

export interface OliRental {
  id: string;
  vehicle_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Auth helpers
export const signUp = async (email: string, password: string, fullName: string) => {
  const redirectUrl = `${window.location.origin}/onboarding`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: fullName,
      }
    }
  });
  
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async (): Promise<{ user: User | null; session: Session | null }> => {
  const { data: { session } } = await supabase.auth.getSession();
  return { user: session?.user || null, session };
};

// Profile helpers
export const getProfile = async (userId: string): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  
  return data;
};

export const createProfile = async (profile: Partial<OliProfile>): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .insert([profile as any])
    .select()
    .single();
  
  if (error) {
    console.error("Error creating profile:", error);
    return null;
  }
  
  return data;
};

export const updateProfile = async (userId: string, updates: Partial<OliProfile>): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  
  if (error) {
    console.error("Error updating profile:", error);
    return null;
  }
  
  return data;
};

// Vehicle helpers
export const getAvailableVehicles = async (limit?: number): Promise<OliVehicle[]> => {
  let query = supabase
    .from("oli_vehicles")
    .select("*")
    .eq("is_active", true)
    .eq("status", "available")
    .order("created_at", { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching vehicles:", error);
    return [];
  }
  
  return data || [];
};

export const getVehicleById = async (vehicleId: string): Promise<OliVehicle | null> => {
  const { data, error } = await supabase
    .from("oli_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching vehicle:", error);
    return null;
  }
  
  return data;
};

export const getVehiclePhotos = async (vehicleId: string): Promise<OliVehiclePhoto[]> => {
  const { data, error } = await supabase
    .from("oli_vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("is_cover", { ascending: false });
  
  if (error) {
    console.error("Error fetching vehicle photos:", error);
    return [];
  }
  
  return data || [];
};

export const getVehicleCoverPhoto = async (vehicleId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("oli_vehicle_photos")
    .select("image_url")
    .eq("vehicle_id", vehicleId)
    .eq("is_cover", true)
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    return null;
  }
  
  return data.image_url;
};

export const getMyVehicles = async (ownerId: string): Promise<OliVehicle[]> => {
  const { data, error } = await supabase
    .from("oli_vehicles")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching my vehicles:", error);
    return [];
  }
  
  return data || [];
};

// Rental helpers
export const createRental = async (rental: Partial<OliRental>): Promise<OliRental | null> => {
  const { data, error } = await supabase
    .from("oli_rentals")
    .insert([rental as any])
    .select()
    .single();
  
  if (error) {
    console.error("Error creating rental:", error);
    return null;
  }
  
  return data;
};

export const getMyRentalsAsRenter = async (renterId: string): Promise<OliRental[]> => {
  const { data, error } = await supabase
    .from("oli_rentals")
    .select("*")
    .eq("renter_id", renterId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching rentals as renter:", error);
    return [];
  }
  
  return data || [];
};

export const getMyRentalsAsOwner = async (ownerId: string): Promise<OliRental[]> => {
  const { data, error } = await supabase
    .from("oli_rentals")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching rentals as owner:", error);
    return [];
  }
  
  return data || [];
};
