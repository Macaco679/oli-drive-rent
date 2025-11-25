import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, getMyRentalsAsRenter, getMyRentalsAsOwner, getVehicleById, OliRental, OliVehicle } from "@/lib/supabase";
import { Calendar, MapPin, Car } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RentalWithVehicle extends OliRental {
  vehicle?: OliVehicle;
}

export default function Reservations() {
  const [asRenter, setAsRenter] = useState<RentalWithVehicle[]>([]);
  const [asOwner, setAsOwner] = useState<RentalWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRentals();
  }, []);

  const loadRentals = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const [renterRentals, ownerRentals] = await Promise.all([
      getMyRentalsAsRenter(user.id),
      getMyRentalsAsOwner(user.id),
    ]);

    const renterWithVehicles = await Promise.all(
      renterRentals.map(async (rental) => {
        const vehicle = await getVehicleById(rental.vehicle_id);
        return { ...rental, vehicle: vehicle || undefined };
      })
    );

    const ownerWithVehicles = await Promise.all(
      ownerRentals.map(async (rental) => {
        const vehicle = await getVehicleById(rental.vehicle_id);
        return { ...rental, vehicle: vehicle || undefined };
      })
    );

    setAsRenter(renterWithVehicles);
    setAsOwner(ownerWithVehicles);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pending_approval: { label: "Pendente", variant: "secondary" },
      awaiting_payment: { label: "Aguardando pagamento", variant: "secondary" },
      confirmed: { label: "Confirmada", variant: "default" },
      in_use: { label: "Em uso", variant: "default" },
      completed: { label: "Concluída", variant: "secondary" },
      cancelled: { label: "Cancelada", variant: "destructive" },
    };

    const statusInfo = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const RentalCard = ({ rental }: { rental: RentalWithVehicle }) => {
    const vehicleTitle = rental.vehicle?.title || 
      `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim() ||
      "Veículo";

    return (
      <div className="card-elevated p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{vehicleTitle}</h3>
            {rental.vehicle && (
              <p className="text-sm text-muted-foreground">
                {rental.vehicle.location_city} - {rental.vehicle.location_state}
              </p>
            )}
          </div>
          {getStatusBadge(rental.status)}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {format(new Date(rental.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
              {format(new Date(rental.end_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          
          {rental.pickup_location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{rental.pickup_location}</span>
            </div>
          )}

          {rental.total_price && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold text-primary">
                R$ {rental.total_price.toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const EmptyState = ({ message, action }: { message: string; action: string }) => (
    <div className="text-center py-12">
      <Car className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-4">{message}</p>
      <button
        onClick={() => navigate("/search")}
        className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 px-6"
      >
        {action}
      </button>
    </div>
  );

  return (
    <MobileLayout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Minhas Reservas</h1>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <Tabs defaultValue="renter" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="renter">Como motorista</TabsTrigger>
              <TabsTrigger value="owner">Como locador</TabsTrigger>
            </TabsList>

            <TabsContent value="renter" className="space-y-4 mt-4">
              {asRenter.length === 0 ? (
                <EmptyState
                  message="Você ainda não tem reservas ativas"
                  action="Buscar carros"
                />
              ) : (
                asRenter.map((rental) => <RentalCard key={rental.id} rental={rental} />)
              )}
            </TabsContent>

            <TabsContent value="owner" className="space-y-4 mt-4">
              {asOwner.length === 0 ? (
                <EmptyState
                  message="Você ainda não tem reservas como locador"
                  action="Ver meus veículos"
                />
              ) : (
                asOwner.map((rental) => <RentalCard key={rental.id} rental={rental} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MobileLayout>
  );
}
