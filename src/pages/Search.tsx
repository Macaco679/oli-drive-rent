import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAvailableVehicles, getVehicleCoverPhoto, OliVehicle } from "@/lib/supabase";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";

interface VehicleWithCover extends OliVehicle {
  coverImage?: string;
}

export default function Search() {
  const location = useLocation();
  const [vehicles, setVehicles] = useState<VehicleWithCover[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<VehicleWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    loadVehicles();
    
    if (location.state?.selectedType) {
      setSelectedFilter(location.state.selectedType);
    }
  }, [location.state]);

  useEffect(() => {
    applyFilters();
  }, [vehicles, searchText, selectedFilter]);

  const loadVehicles = async () => {
    const allVehicles = await getAvailableVehicles();
    
    const vehiclesWithCovers = await Promise.all(
      allVehicles.map(async (vehicle) => {
        const coverImage = await getVehicleCoverPhoto(vehicle.id);
        return { ...vehicle, coverImage: coverImage || undefined };
      })
    );

    setVehicles(vehiclesWithCovers);
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...vehicles];

    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.brand?.toLowerCase().includes(search) ||
          v.model?.toLowerCase().includes(search) ||
          v.year?.toString().includes(search)
      );
    }

    setFilteredVehicles(filtered);
  };

  const filters = [
    { id: "automatic", label: "Automático" },
    { id: "economico", label: "Econômico" },
    { id: "suv", label: "SUV" },
    { id: "popular", label: "Popular" },
  ];

  return (
    <MobileLayout>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-4">Buscar Veículos</h1>
          
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por modelo, marca ou ano"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="p-2 border border-border rounded-lg hover:bg-secondary transition-colors">
            <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
          {filters.map((filter) => (
            <Badge
              key={filter.id}
              variant={selectedFilter === filter.id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedFilter(selectedFilter === filter.id ? null : filter.id)}
            >
              {filter.label}
            </Badge>
          ))}
        </div>

        {/* Results */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {filteredVehicles.length} veículos encontrados
          </p>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">Nenhum veículo encontrado</p>
              <p className="text-sm text-muted-foreground">
                Tente ajustar seus filtros de busca
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVehicles.map((vehicle) => (
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
      </div>
    </MobileLayout>
  );
}
