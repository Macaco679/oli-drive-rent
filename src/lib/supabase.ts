// ============================================================
// SUPABASE CONECTADO - Funções Reais
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export interface OliProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  birth_date: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  role: "renter" | "owner" | "both";
  signature_url: string | null;
  created_at: string;
  updated_at: string;
  score: number | null;
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
  pickup_neighborhood: string | null;
  pickup_street: string | null;
  pickup_number: string | null;
  pickup_complement: string | null;
  pickup_zip_code: string | null;
  is_active: boolean;
  status: "available" | "rented" | "maintenance" | "inactive";
  vehicle_type: string;
  body_type: string | null;
  segment: string | null;
  is_popular: boolean;
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

// ============================================================
// AUTH HELPERS
// ============================================================

export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: window.location.origin,
    },
  });

  if (!error && data.user) {
    // Criar perfil automaticamente
    await supabase.from("oli_profiles").insert({
      id: data.user.id,
      full_name: fullName,
      role: "renter",
    });
  }

  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/auth/callback",
    },
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (error) {
    return { user: null, session: null };
  }
  
  return { user, session };
};

// ============================================================
// PROFILE HELPERS
// ============================================================

export const getProfile = async (userId: string): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Erro ao buscar perfil:", error);
    return null;
  }

  return data as OliProfile;
};

export const createProfile = async (profile: Partial<OliProfile> & { id: string }): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .insert([profile])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar perfil:", error);
    return null;
  }

  return data as OliProfile;
};

export const updateProfile = async (userId: string, updates: Partial<OliProfile>): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar perfil:", error);
    return null;
  }

  return data as OliProfile;
};

// ============================================================
// VEHICLE HELPERS
// ============================================================

export const getAvailableVehicles = async (limit?: number): Promise<OliVehicle[]> => {
  let query = supabase
    .from("oli_vehicles")
    .select("*")
    .eq("is_active", true)
    .eq("status", "available");

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar veículos disponíveis:", error);
    return [];
  }

  return (data || []) as OliVehicle[];
};

export const getAllVehicles = async (limit?: number): Promise<OliVehicle[]> => {
  let query = supabase
    .from("oli_vehicles")
    .select("*")
    .eq("is_active", true);

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar todos os veículos:", error);
    return [];
  }

  return (data || []) as OliVehicle[];
};

export const getVehicleById = async (vehicleId: string): Promise<OliVehicle | null> => {
  const { data, error } = await supabase
    .from("oli_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .single();

  if (error) {
    console.error("Erro ao buscar veículo:", error);
    return null;
  }

  return data as OliVehicle;
};

export const getVehiclePhotos = async (vehicleId: string): Promise<OliVehiclePhoto[]> => {
  const { data, error } = await supabase
    .from("oli_vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("is_cover", { ascending: false });

  if (error) {
    console.error("Erro ao buscar fotos do veículo:", error);
    return [];
  }

  // Normaliza URLs para corrigir typos no host
  const correctHost = "sgpktbljjlixmyjmhppa.supabase.co";
  const normalized = (data || []).map((photo) => {
    if (!photo.image_url) return photo;
    try {
      const parsed = new URL(photo.image_url);
      if (parsed.hostname.includes("sgpktblj") && parsed.hostname !== correctHost) {
        parsed.hostname = correctHost;
        return { ...photo, image_url: parsed.toString() };
      }
    } catch {
      // ignora URLs inválidas
    }
    return photo;
  });

  return normalized as OliVehiclePhoto[];
};

/**
 * Normaliza uma URL de imagem para apontar para o host correto do Supabase.
 * Corrige typos como "sgpktbljjlixmyjmhppah" -> "sgpktbljjlixmyjmhppa"
 */
const normalizeImageUrl = (url: string): string => {
  if (!url) return url;
  const correctHost = "sgpktbljjlixmyjmhppa.supabase.co";
  try {
    const parsed = new URL(url);
    // Se o host contém o projeto ref mas tem typo (ex: "h" extra), corrige
    if (parsed.hostname.includes("sgpktblj") && parsed.hostname !== correctHost) {
      parsed.hostname = correctHost;
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
};

export const getVehicleCoverPhoto = async (vehicleId: string): Promise<string | null> => {
  // 1) Tenta pegar a capa na tabela
  const coverRes = await supabase
    .from("oli_vehicle_photos")
    .select("image_url")
    .eq("vehicle_id", vehicleId)
    .eq("is_cover", true)
    .limit(1)
    .maybeSingle();

  const coverUrl = coverRes.data?.image_url ?? null;
  if (coverUrl) return normalizeImageUrl(coverUrl);

  // 2) Se não houver capa, tenta qualquer foto na tabela
  const anyRes = await supabase
    .from("oli_vehicle_photos")
    .select("image_url")
    .eq("vehicle_id", vehicleId)
    .limit(1)
    .maybeSingle();

  const anyUrl = anyRes.data?.image_url ?? null;
  if (anyUrl) return normalizeImageUrl(anyUrl);

  // 3) Fallback: buscar direto no Storage (bucket vehicle-photos/{vehicleId}/...)
  const { data: files, error: listErr } = await supabase.storage
    .from("vehicle-photos")
    .list(vehicleId, { limit: 100 });

  if (listErr || !files || files.length === 0) return null;

  // Pega o primeiro arquivo "real" (não pasta)
  const first = files.find((f) => !!f.name && !f.name.endsWith("/"));
  if (!first?.name) return null;

  const { data } = supabase.storage
    .from("vehicle-photos")
    .getPublicUrl(`${vehicleId}/${first.name}`);

  return data.publicUrl || null;
};

export const getMyVehicles = async (ownerId: string): Promise<OliVehicle[]> => {
  const { data, error } = await supabase
    .from("oli_vehicles")
    .select("*")
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Erro ao buscar meus veículos:", error);
    return [];
  }

  return (data || []) as OliVehicle[];
};

// ============================================================
// RENTAL HELPERS
// ============================================================

export const createRental = async (rental: {
  vehicle_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  pickup_location?: string;
  dropoff_location?: string;
  total_price?: number;
  deposit_amount?: number;
  notes?: string;
}): Promise<OliRental | null> => {
  const { data, error } = await supabase
    .from("oli_rentals")
    .insert([rental])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar reserva:", error);
    return null;
  }

  return data as OliRental;
};

export const getMyRentalsAsRenter = async (renterId: string): Promise<OliRental[]> => {
  const { data, error } = await supabase
    .from("oli_rentals")
    .select("*")
    .eq("renter_id", renterId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar minhas reservas:", error);
    return [];
  }

  return (data || []) as OliRental[];
};

export const getMyRentalsAsOwner = async (ownerId: string): Promise<OliRental[]> => {
  const { data, error } = await supabase
    .from("oli_rentals")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar reservas dos meus veículos:", error);
    return [];
  }

  return (data || []) as OliRental[];
};

export const updateRentalStatus = async (
  rentalId: string,
  status: "pending_approval" | "approved" | "active" | "completed" | "cancelled"
): Promise<boolean> => {
  const { error } = await supabase
    .from("oli_rentals")
    .update({ status })
    .eq("id", rentalId);

  if (error) {
    console.error("Erro ao atualizar status da reserva:", error);
    return false;
  }

  return true;
};

export const getProfileById = async (userId: string): Promise<OliProfile | null> => {
  const { data, error } = await supabase
    .from("oli_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Erro ao buscar perfil por ID:", error);
    return null;
  }

  return data as OliProfile;
};
