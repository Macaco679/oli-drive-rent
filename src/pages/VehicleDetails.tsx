import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { getVehicleById, getVehiclePhotos, getCurrentUser, OliVehicle, OliVehiclePhoto } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Calendar, Users, Fuel, Gauge, Palette, Car, MessageCircle } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useVehiclePhotosRealtime } from "@/hooks/useVehiclePhotosRealtime";
import { useChatWidget } from "@/contexts/ChatWidgetContext";

// Static fallback images
import onixAzul from "@/assets/vehicles/onix-azul-2022.jpeg";
import hb20Prata from "@/assets/vehicles/hb20-prata-2024.png";
import argo2026 from "@/assets/vehicles/argo-2026.jpeg";
import basaltBranco from "@/assets/vehicles/basalt-branco-2024.jpeg";
import kicksPreto from "@/assets/vehicles/kicks-preto-2024.png";
import kicksPrata from "@/assets/vehicles/kicks-prata-2024.png";
import onixPrata from "@/assets/vehicles/onix-prata-2019.jpeg";
import prismaPreto from "@/assets/vehicles/prisma-preto-2019.jpeg";

// Helper to create static vehicle objects
const createStaticVehicle = (
  id: string,
  title: string,
  brand: string,
  model: string,
  year: number,
  dailyPrice: number,
  weeklyPrice: number,
  city: string,
  state: string,
  coverImage: string
): { vehicle: OliVehicle; coverImage: string } => ({
  vehicle: {
    id,
    owner_id: "",
    title,
    brand,
    model,
    year,
    color: null,
    plate: null,
    renavam: null,
    transmission: null,
    fuel_type: null,
    seats: null,
    daily_price: dailyPrice,
    weekly_price: weeklyPrice,
    monthly_price: null,
    deposit_amount: null,
    has_driver_option: false,
    driver_daily_price: null,
    driver_notes: null,
    mileage_limit_per_day: null,
    location_city: city,
    location_state: state,
    pickup_neighborhood: null,
    pickup_street: null,
    pickup_number: null,
    pickup_complement: null,
    pickup_zip_code: null,
    is_active: true,
    status: "available",
    vehicle_type: "carro",
    body_type: null,
    segment: null,
    is_popular: false,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  coverImage,
});

const staticVehicleFallback: Record<string, { vehicle: OliVehicle; coverImage: string }> = {
  "static-1": createStaticVehicle("static-1", "Chevrolet Onix LT 2022", "Chevrolet", "Onix LT", 2022, 150, 900, "São Paulo", "SP", onixAzul),
  "static-2": createStaticVehicle("static-2", "Hyundai HB20 Vision 2024", "Hyundai", "HB20 Vision", 2024, 140, 850, "São Paulo", "SP", hb20Prata),
  "static-3": createStaticVehicle("static-3", "Fiat Argo Drive 2026", "Fiat", "Argo Drive", 2026, 160, 950, "São Paulo", "SP", argo2026),
  "static-4": createStaticVehicle("static-4", "Citroën Basalt 2024", "Citroën", "Basalt", 2024, 180, 1100, "São Paulo", "SP", basaltBranco),
  "static-5": createStaticVehicle("static-5", "Nissan Kicks 2024", "Nissan", "Kicks", 2024, 200, 1200, "São Paulo", "SP", kicksPreto),
  "static-6": createStaticVehicle("static-6", "Nissan Kicks Prata 2024", "Nissan", "Kicks", 2024, 195, 1150, "Rio de Janeiro", "RJ", kicksPrata),
  "static-7": createStaticVehicle("static-7", "Chevrolet Onix 2019", "Chevrolet", "Onix", 2019, 120, 700, "Belo Horizonte", "MG", onixPrata),
  "static-8": createStaticVehicle("static-8", "Chevrolet Prisma 2019", "Chevrolet", "Prisma", 2019, 130, 780, "Curitiba", "PR", prismaPreto),
};

export default function VehicleDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startConversationWith } = useChatWidget();
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [photos, setPhotos] = useState<OliVehiclePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showReservationNotice, setShowReservationNotice] = useState(false);

  const tryFallbackForPhoto = async (photoId: string) => {
    if (!id) return;
    try {
      const { data: files, error } = await supabase.storage
        .from("vehicle-photos")
        .list(id, { limit: 1, sortBy: { column: "created_at", order: "desc" } });

      if (error || !files || files.length === 0) return;
      const file = files.find((f) => !!f.name && !f.name.endsWith("/"));
      if (!file?.name) return;

      const { data } = supabase.storage
        .from("vehicle-photos")
        .getPublicUrl(`${id}/${file.name}`);

      if (!data.publicUrl) return;
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, image_url: data.publicUrl } : p))
      );
    } catch {
      // ignore
    }
  };

  // Realtime: listen for photo changes on this vehicle
  const handlePhotoInsert = useCallback((photo: OliVehiclePhoto) => {
    setPhotos((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === photo.id)) return prev;
      // If this is the cover, put it first
      if (photo.is_cover) {
        return [photo, ...prev.map((p) => ({ ...p, is_cover: false }))];
      }
      return [...prev, photo];
    });
  }, []);

  const handlePhotoUpdate = useCallback((photo: OliVehiclePhoto) => {
    setPhotos((prev) => {
      const updated = prev.map((p) =>
        p.id === photo.id ? photo : photo.is_cover ? { ...p, is_cover: false } : p
      );
      // If this is the new cover, move it to front
      if (photo.is_cover) {
        const cover = updated.find((p) => p.id === photo.id);
        const rest = updated.filter((p) => p.id !== photo.id);
        return cover ? [cover, ...rest] : updated;
      }
      return updated;
    });
  }, []);

  const handlePhotoDelete = useCallback(
    (oldPhoto: { id: string; vehicle_id: string }) => {
      setPhotos((prev) => prev.filter((p) => p.id !== oldPhoto.id));
    },
    []
  );

  useVehiclePhotosRealtime({
    vehicleId: id,
    onInsert: handlePhotoInsert,
    onUpdate: handlePhotoUpdate,
    onDelete: handlePhotoDelete,
  });

  useEffect(() => {
    if (id) {
      loadVehicleData(id);
    }
    checkAuth();
  }, [id]);

  const checkAuth = async () => {
    try {
      const { user } = await getCurrentUser();
      setIsAuthenticated(!!user);
      setCurrentUserId(user?.id || null);
    } catch {
      setIsAuthenticated(false);
      setCurrentUserId(null);
    }
  };

  const loadVehicleData = async (vehicleId: string) => {
    // Fallback for static vehicles
    if (vehicleId.startsWith("static-") && staticVehicleFallback[vehicleId]) {
      const fallback = staticVehicleFallback[vehicleId];
      setVehicle(fallback.vehicle);
      setPhotos([
        {
          id: `static-photo-${vehicleId}`,
          vehicle_id: vehicleId,
          image_url: fallback.coverImage,
          is_cover: true,
          created_at: new Date(0).toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const vehicleData = await getVehicleById(vehicleId);

      if (!vehicleData) {
        setVehicle(null);
        setPhotos([]);
        return;
      }

      // 1) First try the table
      let vehiclePhotos = await getVehiclePhotos(vehicleId);

      // 2) If no photos in table, try Storage directly
      if (!vehiclePhotos || vehiclePhotos.length === 0) {
        const { data: files, error } = await supabase.storage
          .from("vehicle-photos")
          .list(vehicleId, { limit: 100 });

        if (!error && files && files.length > 0) {
          const mapped = files
            .filter((f) => !!f.name && !f.name.endsWith("/"))
            .map((f, idx) => {
              const { data } = supabase.storage
                .from("vehicle-photos")
                .getPublicUrl(`${vehicleId}/${f.name}`);
              return {
                id: `storage-${vehicleId}-${idx}`,
                vehicle_id: vehicleId,
                image_url: data.publicUrl,
                is_cover: idx === 0,
                created_at: new Date(0).toISOString(),
              } satisfies OliVehiclePhoto;
            });

          vehiclePhotos = mapped;
        }
      }

      setVehicle(vehicleData);
      setPhotos(vehiclePhotos || []);
    } catch (e: any) {
      console.error("Error loading vehicle details:", e);
      toast.error("Erro ao carregar o veículo. Tente novamente.");
      setVehicle(null);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReservation = () => {
    setShowReservationNotice(true);
  };

  const handleReservationContinue = () => {
    setShowReservationNotice(false);
    if (!isAuthenticated) {
      navigate("/auth", { state: { returnTo: `/book/${vehicle?.id}` } });
    } else {
      navigate(`/book/${vehicle?.id}`);
    }
  };

  const handleContactOwner = () => {
    if (!vehicle) return;

    if (!isAuthenticated) {
      navigate("/auth", { state: { returnTo: `/vehicle/${vehicle.id}` } });
      return;
    }

    if (currentUserId === vehicle.owner_id) {
      toast.error("Vocàª não pode enviar mensagem para si mesmo");
      return;
    }

    // Open chat widget with this owner
    startConversationWith(vehicle.owner_id);
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
          <p className="text-muted-foreground">Veiculo nao encontrado</p>
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
                          className="w-full h-full object-contain bg-gradient-to-br from-muted to-muted/50"
                          loading="lazy"
                          onError={() => tryFallbackForPhoto(photo.id)}
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


            {/* Listing Conditions */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-xl font-semibold">Condicoes do anuncio</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Reserva sem motorista</span>
                  <span className="font-medium">
                    {vehicle.daily_price ? `R$ ${vehicle.daily_price.toLocaleString("pt-BR")} / dia` : "Sob consulta"}
                  </span>
                </div>

                {vehicle.has_driver_option ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Reserva com motorista</span>
                      <span className="font-medium">
                        {vehicle.daily_price != null && vehicle.driver_daily_price != null
                          ? `R$ ${(vehicle.daily_price + vehicle.driver_daily_price).toLocaleString("pt-BR")} / dia`
                          : "Sob consulta"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Adicional do motorista</span>
                      <span className="font-medium">
                        {vehicle.driver_daily_price != null ? `R$ ${vehicle.driver_daily_price.toLocaleString("pt-BR")} / dia` : "Sob consulta"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Este anuncio nao oferece motorista disponibilizado pelo locador.</p>
                )}

                {vehicle.driver_notes ? (
                  <div className="rounded-xl bg-secondary/50 p-3 text-muted-foreground">
                    {vehicle.driver_notes}
                  </div>
                ) : null}

                {vehicle.mileage_limit_per_day ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Limite de quilometragem</span>
                    <span className="font-medium">{vehicle.mileage_limit_per_day} km por dia</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleReservation}
                className="w-full h-14 text-lg rounded-full"
                size="lg"
              >
                Iniciar reserva
              </Button>

              <Button
                onClick={handleContactOwner}
                className="w-full h-14 text-lg rounded-full"
                size="lg"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Falar com proprietário
              </Button>
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={showReservationNotice} onOpenChange={setShowReservationNotice}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Antes de iniciar a reserva</AlertDialogTitle>
            <AlertDialogDescription>
              Para seguir, confirme que a documentacao do motorista e a situacao do veiculo estao regulares. Reservas com pendencias cadastrais, documentais ou operacionais podem nao ser aprovadas pela plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar depois</AlertDialogCancel>
            <AlertDialogAction onClick={handleReservationContinue}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WebLayout>
  );
}


