// ============================================================
// SUPABASE DESCONECTADO - Funções Mock
// Quando você conectar um novo Supabase, atualize este arquivo
// ============================================================

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

// ============================================================
// DADOS MOCK PARA DEMONSTRAÇÃO
// ============================================================

const MOCK_USER_ID = "mock-user-123";

const mockProfile: OliProfile = {
  id: MOCK_USER_ID,
  full_name: "Usuário Demo",
  cpf: null,
  birth_date: null,
  phone: "(11) 99999-9999",
  whatsapp_phone: "(11) 99999-9999",
  role: "both",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Importar imagens dos veículos
import hb20Prata from "@/assets/vehicles/hb20-prata-2024.png";
import onixPrata from "@/assets/vehicles/onix-prata-2019.jpeg";
import argoCinza from "@/assets/vehicles/argo-2026.jpeg";
import onixAzul from "@/assets/vehicles/onix-azul-2022.jpeg";
import basaltBranco from "@/assets/vehicles/basalt-branco-2024.jpeg";
import prismaPreta from "@/assets/vehicles/prisma-preto-2019.jpeg";
import kicksPreto from "@/assets/vehicles/kicks-preto-2024.png";
import kicksPrata from "@/assets/vehicles/kicks-prata-2024.png";

const mockVehicles: OliVehicle[] = [
  {
    id: "vehicle-1",
    owner_id: "owner-1",
    title: "Hyundai HB20 Prata",
    brand: "Hyundai",
    model: "HB20",
    year: 2024,
    color: "Prata",
    plate: "ABC-1234",
    renavam: null,
    transmission: "automático",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 200,
    weekly_price: 900,
    monthly_price: 3200,
    deposit_amount: 2000,
    location_city: "São Paulo",
    location_state: "SP",
    is_active: true,
    status: "unavailable",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-2",
    owner_id: "owner-2",
    title: "Chevrolet Onix Prata",
    brand: "Chevrolet",
    model: "Onix",
    year: 2019,
    color: "Prata",
    plate: "DEF-5678",
    renavam: null,
    transmission: "manual",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 200,
    weekly_price: 800,
    monthly_price: 2800,
    deposit_amount: 2000,
    location_city: "São Paulo",
    location_state: "SP",
    is_active: true,
    status: "unavailable",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-3",
    owner_id: "owner-3",
    title: "Fiat Argo",
    brand: "Fiat",
    model: "Argo",
    year: 2026,
    color: "Cinza",
    plate: "GHI-9012",
    renavam: null,
    transmission: "automático",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 200,
    weekly_price: 900,
    monthly_price: 3200,
    deposit_amount: 2000,
    location_city: "Campinas",
    location_state: "SP",
    is_active: true,
    status: "unavailable",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-4",
    owner_id: "owner-1",
    title: "Chevrolet Onix Azul Sedan",
    brand: "Chevrolet",
    model: "Onix Plus",
    year: 2022,
    color: "Azul",
    plate: "JKL-3456",
    renavam: null,
    transmission: "automático",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 200,
    weekly_price: 900,
    monthly_price: 3200,
    deposit_amount: 2000,
    location_city: "São Paulo",
    location_state: "SP",
    is_active: true,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-5",
    owner_id: "owner-2",
    title: "Citroën Basalt Branco",
    brand: "Citroën",
    model: "Basalt",
    year: 2024,
    color: "Branco",
    plate: "MNO-7890",
    renavam: null,
    transmission: "automático",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 300,
    weekly_price: 1200,
    monthly_price: 4200,
    deposit_amount: 3000,
    location_city: "São Paulo",
    location_state: "SP",
    is_active: true,
    status: "unavailable",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-6",
    owner_id: "owner-3",
    title: "Chevrolet Prisma Preto",
    brand: "Chevrolet",
    model: "Prisma",
    year: 2019,
    color: "Preto",
    plate: "PQR-1234",
    renavam: null,
    transmission: "manual",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 180,
    weekly_price: 750,
    monthly_price: 2600,
    deposit_amount: 2000,
    location_city: "Guarulhos",
    location_state: "SP",
    is_active: true,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-7",
    owner_id: "owner-1",
    title: "Nissan Kicks Preto",
    brand: "Nissan",
    model: "Kicks",
    year: 2024,
    color: "Preto",
    plate: "STU-5678",
    renavam: null,
    transmission: "automático",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 280,
    weekly_price: 1100,
    monthly_price: 3800,
    deposit_amount: 2500,
    location_city: "São Paulo",
    location_state: "SP",
    is_active: true,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "vehicle-8",
    owner_id: "owner-2",
    title: "Nissan Kicks Prata",
    brand: "Nissan",
    model: "Kicks",
    year: 2024,
    color: "Prata",
    plate: "VWX-9012",
    renavam: null,
    transmission: "automático",
    fuel_type: "Flex",
    seats: 5,
    daily_price: 280,
    weekly_price: 1100,
    monthly_price: 3800,
    deposit_amount: 2500,
    location_city: "Osasco",
    location_state: "SP",
    is_active: true,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mapeamento de imagens dos veículos
const vehicleImages: Record<string, string> = {
  "vehicle-1": hb20Prata,
  "vehicle-2": onixPrata,
  "vehicle-3": argoCinza,
  "vehicle-4": onixAzul,
  "vehicle-5": basaltBranco,
  "vehicle-6": prismaPreta,
  "vehicle-7": kicksPreto,
  "vehicle-8": kicksPrata,
};

const mockRentals: OliRental[] = [];

// Estado local para simular persistência durante a sessão
let localProfile: OliProfile | null = null;
let isLoggedIn = false;

// ============================================================
// AUTH HELPERS (MOCK)
// ============================================================

export const signUp = async (email: string, password: string, fullName: string) => {
  // Simula criação de conta
  await new Promise(resolve => setTimeout(resolve, 500));
  
  localProfile = {
    ...mockProfile,
    full_name: fullName,
  };
  isLoggedIn = true;
  
  return { 
    data: { user: { id: MOCK_USER_ID, email } }, 
    error: null 
  };
};

export const signIn = async (email: string, password: string) => {
  // Simula login
  await new Promise(resolve => setTimeout(resolve, 500));
  
  isLoggedIn = true;
  if (!localProfile) {
    localProfile = { ...mockProfile };
  }
  
  return { 
    data: { user: { id: MOCK_USER_ID, email } }, 
    error: null 
  };
};

export const signOut = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  isLoggedIn = false;
  localProfile = null;
  return { error: null };
};

export const getCurrentUser = async (): Promise<{ user: { id: string; email: string } | null; session: null }> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (isLoggedIn) {
    return { 
      user: { id: MOCK_USER_ID, email: "demo@oliapp.com" }, 
      session: null 
    };
  }
  
  return { user: null, session: null };
};

// ============================================================
// PROFILE HELPERS (MOCK)
// ============================================================

export const getProfile = async (userId: string): Promise<OliProfile | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return localProfile;
};

export const createProfile = async (profile: Partial<OliProfile>): Promise<OliProfile | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  localProfile = {
    ...mockProfile,
    ...profile,
    id: MOCK_USER_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as OliProfile;
  
  return localProfile;
};

export const updateProfile = async (userId: string, updates: Partial<OliProfile>): Promise<OliProfile | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  if (localProfile) {
    localProfile = {
      ...localProfile,
      ...updates,
      updated_at: new Date().toISOString(),
    };
  }
  
  return localProfile;
};

// ============================================================
// VEHICLE HELPERS (MOCK)
// ============================================================

export const getAvailableVehicles = async (limit?: number): Promise<OliVehicle[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const available = mockVehicles.filter(v => v.is_active && v.status === "available");
  return limit ? available.slice(0, limit) : available;
};

export const getAllVehicles = async (limit?: number): Promise<OliVehicle[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return limit ? mockVehicles.slice(0, limit) : mockVehicles;
};

export const getVehicleById = async (vehicleId: string): Promise<OliVehicle | null> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockVehicles.find(v => v.id === vehicleId) || null;
};

export const getVehiclePhotos = async (vehicleId: string): Promise<OliVehiclePhoto[]> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  // Retorna array vazio - sem fotos no mock
  return [];
};

export const getVehicleCoverPhoto = async (vehicleId: string): Promise<string | null> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return vehicleImages[vehicleId] || null;
};

export const getMyVehicles = async (ownerId: string): Promise<OliVehicle[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockVehicles.filter(v => v.owner_id === ownerId);
};

// ============================================================
// RENTAL HELPERS (MOCK)
// ============================================================

export const createRental = async (rental: Partial<OliRental>): Promise<OliRental | null> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const newRental: OliRental = {
    id: `rental-${Date.now()}`,
    vehicle_id: rental.vehicle_id || "",
    renter_id: rental.renter_id || MOCK_USER_ID,
    owner_id: rental.owner_id || "",
    start_date: rental.start_date || "",
    end_date: rental.end_date || "",
    pickup_location: rental.pickup_location || null,
    dropoff_location: rental.dropoff_location || null,
    total_price: rental.total_price || null,
    deposit_amount: rental.deposit_amount || null,
    status: rental.status || "pending_approval",
    notes: rental.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  mockRentals.push(newRental);
  return newRental;
};

export const getMyRentalsAsRenter = async (renterId: string): Promise<OliRental[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockRentals.filter(r => r.renter_id === renterId);
};

export const getMyRentalsAsOwner = async (ownerId: string): Promise<OliRental[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockRentals.filter(r => r.owner_id === ownerId);
};
