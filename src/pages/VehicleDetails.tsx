import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { getVehicleById, getVehiclePhotos, OliVehicle, OliVehiclePhoto } from "@/lib/supabase";
import { ArrowLeft, MapPin, Calendar, Users, Fuel, Gauge, Palette, Car } from "lucide-react";
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
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </WebLayout>
    );
  }

  if (!vehicle) {
    return (
      <WebLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-muted-foreground">Veículo não encontrado</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Voltar
          </Button>
        </div>
      </WebLayout>
    );
  }

  const vehicleTitle = vehicle.title || `${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""}`.trim();
  const location = vehicle.location_city && vehicle.location_state 
    ? `${vehicle.location_city} - ${vehicle.location_state}` 
    : "Localização não informada";

  return (
    <WebLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Photos */}
          <div>
            {photos.length > 0 ? (
              <Carousel className="w-full">
                <CarouselContent>
                  {photos.map((photo) => (
                    <CarouselItem key={photo.id}>
                      <div className="aspect-video bg-muted rounded-2xl overflow-hidden">
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
                    <CarouselPrevious className="left-4" />
                    <CarouselNext className="right-4" />
                  </>
                )}
              </Carousel>
            ) : (
              <div className="aspect-video bg-muted rounded-2xl flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Car className="w-16 h-16 mx-auto mb-2" />
                  <p>Sem fotos disponíveis</p>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            {/* Title and Location */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{vehicleTitle}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-5 h-5" />
                <span>{location}</span>
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {vehicle.year && (
                <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
                  <Calendar className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ano</p>
                    <p className="font-semibold">{vehicle.year}</p>
                  </div>
                </div>
              )}
              {vehicle.color && (
                <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
                  <Palette className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cor</p>
                    <p className="font-semibold">{vehicle.color}</p>
                  </div>
                </div>
              )}
              {vehicle.transmission && (
                <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
                  <Gauge className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Câmbio</p>
                    <p className="font-semibold capitalize">{vehicle.transmission}</p>
                  </div>
                </div>
              )}
              {vehicle.fuel_type && (
                <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
                  <Fuel className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Combustível</p>
                    <p className="font-semibold">{vehicle.fuel_type}</p>
                  </div>
                </div>
              )}
              {vehicle.seats && (
                <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
                  <Users className="w-6 h-6 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lugares</p>
                    <p className="font-semibold">{vehicle.seats}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Prices */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-xl font-semibold">Valores</h3>
              <div className="space-y-3">
                {vehicle.daily_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Diária</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {vehicle.daily_price.toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                {vehicle.weekly_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Semanal</span>
                    <span className="text-xl font-semibold text-primary">
                      R$ {vehicle.weekly_price.toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                {vehicle.monthly_price && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Mensal</span>
                    <span className="text-xl font-semibold text-primary">
                      R$ {vehicle.monthly_price.toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                {vehicle.deposit_amount && (
                  <div className="flex justify-between items-center pt-3 border-t border-border">
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
              className="w-full h-14 text-lg"
              size="lg"
            >
              Iniciar reserva
            </Button>
          </div>
        </div>
      </div>
    </WebLayout>
  );
}
