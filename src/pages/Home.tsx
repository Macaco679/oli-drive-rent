import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser, getProfile, getAllVehicles, getVehicleCoverPhoto, OliVehicle, OliVehiclePhoto } from "@/lib/supabase";
import { MapPin, Calendar, Car, Shield, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useEmblaCarousel from "embla-carousel-react";
import { SupabaseDebugPanel } from "@/components/debug/SupabaseDebugPanel";
import { useVehiclePhotosRealtime } from "@/hooks/useVehiclePhotosRealtime";

// Import static vehicle images
import onixAzul from "@/assets/vehicles/onix-azul-2022.jpeg";
import hb20Prata from "@/assets/vehicles/hb20-prata-2024.png";
import argo2026 from "@/assets/vehicles/argo-2026.jpeg";
import basaltBranco from "@/assets/vehicles/basalt-branco-2024.jpeg";
import kicksPreto from "@/assets/vehicles/kicks-preto-2024.png";
import kicksPrata from "@/assets/vehicles/kicks-prata-2024.png";
import onixPrata from "@/assets/vehicles/onix-prata-2019.jpeg";
import prismaPreto from "@/assets/vehicles/prisma-preto-2019.jpeg";

interface VehicleWithCover extends OliVehicle {
  coverImage?: string;
}

interface StaticVehicle {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  daily_price: number;
  weekly_price: number;
  location_city: string;
  location_state: string;
  status: string;
  is_active: boolean;
  coverImage: string;
}

// Static vehicles for display when Supabase data is not available
const staticVehicles: StaticVehicle[] = [
  {
    id: "static-1",
    title: "Chevrolet Onix LT 2022",
    brand: "Chevrolet",
    model: "Onix LT",
    year: 2022,
    daily_price: 150,
    weekly_price: 900,
    location_city: "São Paulo",
    location_state: "SP",
    status: "available",
    is_active: true,
    coverImage: onixAzul,
  },
  {
    id: "static-2",
    title: "Hyundai HB20 Vision 2024",
    brand: "Hyundai",
    model: "HB20 Vision",
    year: 2024,
    daily_price: 140,
    weekly_price: 850,
    location_city: "São Paulo",
    location_state: "SP",
    status: "available",
    is_active: true,
    coverImage: hb20Prata,
  },
  {
    id: "static-3",
    title: "Fiat Argo Drive 2026",
    brand: "Fiat",
    model: "Argo Drive",
    year: 2026,
    daily_price: 160,
    weekly_price: 950,
    location_city: "São Paulo",
    location_state: "SP",
    status: "available",
    is_active: true,
    coverImage: argo2026,
  },
  {
    id: "static-4",
    title: "Citroën Basalt 2024",
    brand: "Citroën",
    model: "Basalt",
    year: 2024,
    daily_price: 180,
    weekly_price: 1100,
    location_city: "São Paulo",
    location_state: "SP",
    status: "available",
    is_active: true,
    coverImage: basaltBranco,
  },
  {
    id: "static-5",
    title: "Nissan Kicks 2024",
    brand: "Nissan",
    model: "Kicks",
    year: 2024,
    daily_price: 200,
    weekly_price: 1200,
    location_city: "São Paulo",
    location_state: "SP",
    status: "available",
    is_active: true,
    coverImage: kicksPreto,
  },
  {
    id: "static-6",
    title: "Nissan Kicks Prata 2024",
    brand: "Nissan",
    model: "Kicks",
    year: 2024,
    daily_price: 195,
    weekly_price: 1150,
    location_city: "Rio de Janeiro",
    location_state: "RJ",
    status: "available",
    is_active: true,
    coverImage: kicksPrata,
  },
  {
    id: "static-7",
    title: "Chevrolet Onix 2019",
    brand: "Chevrolet",
    model: "Onix",
    year: 2019,
    daily_price: 120,
    weekly_price: 700,
    location_city: "Belo Horizonte",
    location_state: "MG",
    status: "available",
    is_active: true,
    coverImage: onixPrata,
  },
  {
    id: "static-8",
    title: "Chevrolet Prisma 2019",
    brand: "Chevrolet",
    model: "Prisma",
    year: 2019,
    daily_price: 130,
    weekly_price: 780,
    location_city: "Curitiba",
    location_state: "PR",
    status: "available",
    is_active: true,
    coverImage: prismaPreto,
  },
];

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [vehicles, setVehicles] = useState<(VehicleWithCover | StaticVehicle)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState("");
  const [searchCar, setSearchCar] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const navigate = useNavigate();

  const showSupabaseDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugSupabase") === "1";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Tenta carregar o perfil se o usuário estiver logado, mas não obriga login
    try {
      const { user } = await getCurrentUser();
      if (user) {
        const userProfile = await getProfile(user.id);
        setProfile(userProfile);
      }
    } catch (error) {
      // Usuário não logado - continua sem perfil
      console.log("Usuário não autenticado, navegando como visitante");
    }

    // Carrega todos os veículos independente do login (para o carrossel)
    try {
      const allVehicles = await getAllVehicles();
      
      if (allVehicles.length > 0) {
        const vehiclesWithCovers = await Promise.all(
          allVehicles.map(async (vehicle) => {
            const coverImage = await getVehicleCoverPhoto(vehicle.id);
            return { ...vehicle, coverImage: coverImage || undefined };
          })
        );
        setVehicles(vehiclesWithCovers);
      } else {
        // Use static vehicles when no data from Supabase
        setVehicles(staticVehicles);
      }
    } catch (error) {
      console.log("Erro ao carregar veículos do Supabase, usando veículos estáticos");
      setVehicles(staticVehicles);
    }

    setLoading(false);
  };

  // Realtime: update cover photos when photos are inserted/updated/deleted
  const handlePhotoInsert = useCallback(async (photo: OliVehiclePhoto) => {
    // If this is a cover photo, update the vehicle's cover image
    if (photo.is_cover) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === photo.vehicle_id ? { ...v, coverImage: photo.image_url } : v
        )
      );
    } else {
      // If no cover exists for this vehicle, use this new photo
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === photo.vehicle_id && !v.coverImage
            ? { ...v, coverImage: photo.image_url }
            : v
        )
      );
    }
  }, []);

  const handlePhotoUpdate = useCallback(async (photo: OliVehiclePhoto) => {
    // If this photo became the cover, update the vehicle
    if (photo.is_cover) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === photo.vehicle_id ? { ...v, coverImage: photo.image_url } : v
        )
      );
    }
  }, []);

  const handlePhotoDelete = useCallback(
    async (oldPhoto: { id: string; vehicle_id: string }) => {
      // Refetch cover for this vehicle
      const newCover = await getVehicleCoverPhoto(oldPhoto.vehicle_id);
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === oldPhoto.vehicle_id
            ? { ...v, coverImage: newCover || undefined }
            : v
        )
      );
    },
    []
  );

  useVehiclePhotosRealtime({
    onInsert: handlePhotoInsert,
    onUpdate: handlePhotoUpdate,
    onDelete: handlePhotoDelete,
  });

  // Carrossel
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    slidesToScroll: 1,
    containScroll: "trimSnaps",
  });
  
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const handleSearch = () => {
    navigate("/search", {
      state: { searchCity, searchCar, startDate, endDate, selectedType }
    });
  };

  const usageTypes = [
    { id: "app", label: "Motorista de app" },
    { id: "daily", label: "Uso diário" },
    { id: "travel", label: "Viagem" },
  ];

  return (
    <WebLayout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-accent text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                {profile ? `Olá, ${profile.full_name?.split(' ')[0] || 'Usuário'}!` : 'Alugue carros com facilidade'}<br />
                {profile ? 'Qual carro você quer alugar hoje?' : 'Conectamos motoristas e proprietários'}
              </h1>
              <p className="text-white/90 text-lg mb-6">
                Planos semanais e diários para motoristas de app e uso comum. Encontre o veículo ideal para suas necessidades.
              </p>
              {!profile && (
                <Button
                  onClick={() => navigate("/auth")}
                  variant="secondary"
                  size="lg"
                  className="mb-4"
                >
                  Entrar ou criar conta
                </Button>
              )}
            </div>

            {/* Search Card */}
            <div className="bg-card text-foreground rounded-2xl shadow-xl p-6 space-y-4">
              <h3 className="text-xl font-semibold">Buscar veículos</h3>
              
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder="Qual carro? Ex: Onix, HB20..."
                  value={searchCar}
                  onChange={(e) => setSearchCar(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder="Cidade ou região de retirada"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {usageTypes.map((type) => (
                  <Badge
                    key={type.id}
                    variant={selectedType === type.id ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
                  >
                    {type.label}
                  </Badge>
                ))}
              </div>

              <Button
                onClick={handleSearch}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-lg"
              >
                Buscar carros
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Available Vehicles */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {showSupabaseDebug && (
            <div className="mb-6">
              <SupabaseDebugPanel />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold mb-2">Carros disponíveis</h2>
              <p className="text-muted-foreground">
                Veja opções prontas para começar a rodar ainda hoje.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate("/search")}
              className="mt-4 sm:mt-0"
            >
              Ver todos
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum veículo disponível no momento
            </div>
          ) : (
            <div className="relative">
              {/* Botão Anterior */}
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-lg flex items-center justify-center transition-opacity ${
                  canScrollPrev ? "opacity-100 hover:bg-muted" : "opacity-0 pointer-events-none"
                }`}
                style={{ marginLeft: "-1.25rem" }}
              >
                <ChevronLeft className="w-6 h-6 text-foreground" />
              </button>

              {/* Carrossel */}
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-6">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex-shrink-0 w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
                      <VehicleCard
                        id={vehicle.id}
                        title={vehicle.title || undefined}
                        brand={vehicle.brand || undefined}
                        model={vehicle.model || undefined}
                        year={vehicle.year || undefined}
                        coverImage={vehicle.coverImage}
                        dailyPrice={vehicle.daily_price || undefined}
                        weeklyPrice={vehicle.weekly_price || undefined}
                        locationCity={vehicle.location_city || undefined}
                        locationState={vehicle.location_state || undefined}
                        status={vehicle.status}
                        isActive={vehicle.is_active}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão Próximo */}
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-lg flex items-center justify-center transition-opacity ${
                  canScrollNext ? "opacity-100 hover:bg-muted" : "opacity-0 pointer-events-none"
                }`}
                style={{ marginRight: "-1.25rem" }}
              >
                <ChevronRight className="w-6 h-6 text-foreground" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 lg:py-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-bold mb-8 text-center">O que você procura?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <button
              onClick={() => navigate("/search", { state: { selectedType: "app" } })}
              className="bg-card p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all text-center group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Car className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Alugar para app</h3>
              <p className="text-muted-foreground">Veículos ideais para Uber, 99 e outros apps</p>
            </button>
            
            <button
              onClick={() => navigate("/search", { state: { selectedType: "travel" } })}
              className="bg-card p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all text-center group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Alugar para viagem</h3>
              <p className="text-muted-foreground">Carros confortáveis para suas viagens</p>
            </button>
            
            <button
              onClick={() => {
                if (!profile) {
                  navigate("/auth");
                } else if (profile?.role === "owner" || profile?.role === "both") {
                  navigate("/my-vehicles");
                } else {
                  alert("Para cadastrar veículos, atualize seu tipo de conta no perfil");
                }
              }}
              className="bg-card p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all text-center group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Car className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Cadastrar meu carro</h3>
              <p className="text-muted-foreground">Ganhe dinheiro alugando seu veículo</p>
            </button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-bold mb-8 text-center">Por que escolher a OLI?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Contratos digitais</h3>
              <p className="text-muted-foreground">
                Segurança jurídica para você e o locador com contratos assinados digitalmente.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Vistoria com fotos</h3>
              <p className="text-muted-foreground">
                Registre o estado do veículo antes e depois do aluguel com fotos detalhadas.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Car className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Para motoristas de app</h3>
              <p className="text-muted-foreground">
                Plataforma pensada especialmente para quem trabalha com aplicativos de transporte.
              </p>
            </div>
          </div>
        </div>
      </section>
    </WebLayout>
  );
}
