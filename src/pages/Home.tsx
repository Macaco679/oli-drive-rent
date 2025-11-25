import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser, getProfile, getAvailableVehicles, getVehicleCoverPhoto, OliVehicle } from "@/lib/supabase";
import { MapPin, Calendar, Car, Shield, CheckCircle2, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VehicleWithCover extends OliVehicle {
  coverImage?: string;
}

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [vehicles, setVehicles] = useState<VehicleWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const userProfile = await getProfile(user.id);
    if (!userProfile) {
      navigate("/onboarding");
      return;
    }

    setProfile(userProfile);

    const availableVehicles = await getAvailableVehicles(5);
    
    const vehiclesWithCovers = await Promise.all(
      availableVehicles.map(async (vehicle) => {
        const coverImage = await getVehicleCoverPhoto(vehicle.id);
        return { ...vehicle, coverImage: coverImage || undefined };
      })
    );

    setVehicles(vehiclesWithCovers);
    setLoading(false);
  };

  const handleSearch = () => {
    navigate("/search", {
      state: { searchCity, startDate, endDate, selectedType }
    });
  };

  const usageTypes = [
    { id: "app", label: "Motorista de app" },
    { id: "daily", label: "Uso diário" },
    { id: "travel", label: "Viagem" },
  ];

  return (
    <MobileLayout>
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OLI</h1>
          {profile && (
            <p className="text-sm opacity-90">Olá, {profile.full_name?.split(' ')[0] || 'Usuário'}</p>
          )}
        </div>
        <button className="p-2 hover:bg-primary-foreground/10 rounded-full transition-colors">
          <HelpCircle className="w-6 h-6" />
        </button>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary to-accent text-white p-6 pb-8">
        <h2 className="text-2xl font-bold mb-2">
          Qual carro você quer alugar hoje?
        </h2>
        <p className="text-white/90 text-sm">
          Planos semanais e diários para motoristas de app e uso comum.
        </p>
      </div>

      {/* Search Card */}
      <div className="px-4 -mt-4 mb-6">
        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Cidade ou região de retirada"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
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
            className="w-full btn-pill bg-primary hover:bg-primary/90"
          >
            Buscar carros
          </Button>
        </div>
      </div>

      {/* Available Vehicles */}
      <section className="px-4 mb-6">
        <h3 className="text-xl font-bold mb-2">Carros disponíveis perto de você</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Veja opções prontas para começar a rodar ainda hoje.
        </p>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum veículo disponível no momento
          </div>
        ) : (
          <div className="space-y-4">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
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
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="px-4 mb-6">
        <h3 className="text-xl font-bold mb-4">Ações rápidas</h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/search", { state: { selectedType: "app" } })}
            className="card-elevated p-4 text-center hover:shadow-[var(--shadow-elevated)] transition-shadow"
          >
            <Car className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium">Alugar para app</p>
          </button>
          <button
            onClick={() => navigate("/search", { state: { selectedType: "travel" } })}
            className="card-elevated p-4 text-center hover:shadow-[var(--shadow-elevated)] transition-shadow"
          >
            <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium">Alugar para viagem</p>
          </button>
          <button
            onClick={() => {
              if (profile?.role === "owner" || profile?.role === "both") {
                navigate("/my-vehicles");
              } else {
                alert("Para cadastrar veículos, atualize seu tipo de conta no perfil");
              }
            }}
            className="card-elevated p-4 text-center hover:shadow-[var(--shadow-elevated)] transition-shadow"
          >
            <Car className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-xs font-medium">Cadastrar meu carro</p>
          </button>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 pb-6">
        <h3 className="text-xl font-bold mb-4">Benefícios</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 card-elevated p-4">
            <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Contratos digitais</h4>
              <p className="text-sm text-muted-foreground">
                Segurança jurídica para você e o locador
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 card-elevated p-4">
            <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Vistoria com fotos</h4>
              <p className="text-sm text-muted-foreground">
                Registre o estado do veículo antes e depois
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 card-elevated p-4">
            <Car className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Para motoristas de app</h4>
              <p className="text-sm text-muted-foreground">
                Plataforma pensada para quem trabalha com aplicativo
              </p>
            </div>
          </div>
        </div>
      </section>
    </MobileLayout>
  );
}
