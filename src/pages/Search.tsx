import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
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
    if (location.state?.searchCar) {
      setSearchText(location.state.searchCar);
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
    <WebLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6">Buscar Veículos</h1>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por modelo, marca ou ano"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button className="p-3 border border-border rounded-lg hover:bg-secondary transition-colors">
                <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
              </button>
              {filters.map((filter) => (
                <Badge
                  key={filter.id}
                  variant={selectedFilter === filter.id ? "default" : "outline"}
                  className="cursor-pointer h-10 px-4"
                  onClick={() => setSelectedFilter(selectedFilter === filter.id ? null : filter.id)}
                >
                  {filter.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <p className="text-muted-foreground mb-6">
            {filteredVehicles.length} veículo{filteredVehicles.length !== 1 ? 's' : ''} encontrado{filteredVehicles.length !== 1 ? 's' : ''}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
    </WebLayout>
  );
}
