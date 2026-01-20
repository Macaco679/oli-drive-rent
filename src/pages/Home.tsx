import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
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
  const [searchCar, setSearchCar] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const navigate = useNavigate();

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

    // Carrega veículos independente do login
    const availableVehicles = await getAvailableVehicles(6);
    
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
