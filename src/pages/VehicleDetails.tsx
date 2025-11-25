import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { getVehicleById, getVehiclePhotos, OliVehicle, OliVehiclePhoto } from "@/lib/supabase";
import { ArrowLeft, MapPin, Calendar, Users, Fuel, Gauge, Palette } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export default function VehicleDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [photos, setPhotos] = useState<OliVehiclePhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadVehicleData(id);
    }
  }, [id]);

  const loadVehicleData = async (vehicleId: string) => {
    const vehicleData = await getVehicleById(vehicleId);
    const vehiclePhotos = await getVehiclePhotos(vehicleId);
    
    setVehicle(vehicleData);
    setPhotos(vehiclePhotos);
    setLoading(false);
  };

  if (loading) {
    return (
      <MobileLayout showBottomNav={false}>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </MobileLayout>
    );
  }

  if (!vehicle) {
    return (
      <MobileLayout showBottomNav={false}>
        <div className="p-4">
          <p className="text-muted-foreground">Veículo não encontrado</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Voltar
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const vehicleTitle = vehicle.title || `${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""}`.trim();
  const location = vehicle.location_city && vehicle.location_state 
    ? `${vehicle.location_city} - ${vehicle.location_state}` 
    : "Localização não informada";

  return (
    <MobileLayout showBottomNav={false}>
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border z-10 p-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold truncate">{vehicleTitle}</h1>
      </div>

      {/* Photos Carousel */}
      <div className="relative">
        {photos.length > 0 ? (
          <Carousel className="w-full">
            <CarouselContent>
              {photos.map((photo) => (
                <CarouselItem key={photo.id}>
                  <div className="h-64 bg-muted">
                    <img
                      src={photo.image_url}
                      alt={vehicleTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {photos.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="h-64 bg-muted flex items-center justify-center text-muted-foreground">
            Sem fotos disponíveis
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Title and Location */}
        <div>
          <h2 className="text-2xl font-bold mb-2">{vehicleTitle}</h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-5 h-5" />
            <span>{location}</span>
          </div>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-4">
          {vehicle.year && (
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Ano</p>
                <p className="font-medium">{vehicle.year}</p>
              </div>
            </div>
          )}
          {vehicle.color && (
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Cor</p>
                <p className="font-medium">{vehicle.color}</p>
              </div>
            </div>
          )}
          {vehicle.transmission && (
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Câmbio</p>
                <p className="font-medium capitalize">{vehicle.transmission}</p>
              </div>
            </div>
          )}
          {vehicle.fuel_type && (
            <div className="flex items-center gap-2">
              <Fuel className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Combustível</p>
                <p className="font-medium">{vehicle.fuel_type}</p>
              </div>
            </div>
          )}
          {vehicle.seats && (
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Lugares</p>
                <p className="font-medium">{vehicle.seats}</p>
              </div>
            </div>
          )}
        </div>

        {/* Prices */}
        <div className="card-elevated p-4 space-y-3">
          <h3 className="font-semibold">Valores</h3>
          <div className="space-y-2">
            {vehicle.daily_price && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diária</span>
                <span className="font-semibold text-primary">
                  R$ {vehicle.daily_price.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {vehicle.weekly_price && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Semanal</span>
                <span className="font-semibold text-primary">
                  R$ {vehicle.weekly_price.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {vehicle.monthly_price && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mensal</span>
                <span className="font-semibold text-primary">
                  R$ {vehicle.monthly_price.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {vehicle.deposit_amount && (
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">Caução</span>
                <span className="font-semibold">
                  R$ {vehicle.deposit_amount.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate(`/book/${vehicle.id}`)}
          className="w-full btn-pill bg-primary hover:bg-primary/90 text-lg h-12"
        >
          Iniciar reserva
        </Button>
      </div>
    </MobileLayout>
  );
}
