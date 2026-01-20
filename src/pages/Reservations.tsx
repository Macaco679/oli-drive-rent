import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-xl">{vehicleTitle}</h3>
            {rental.vehicle && (
              <p className="text-muted-foreground">
                {rental.vehicle.location_city} - {rental.vehicle.location_state}
              </p>
            )}
          </div>
          {getStatusBadge(rental.status)}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="w-5 h-5 flex-shrink-0" />
            <span>
              {format(new Date(rental.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
              {format(new Date(rental.end_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          
          {rental.pickup_location && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPin className="w-5 h-5 flex-shrink-0" />
              <span>{rental.pickup_location}</span>
            </div>
          )}
        </div>

        {rental.total_price && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-muted-foreground">Total</span>
            <span className="text-xl font-bold text-primary">
              R$ {rental.total_price.toLocaleString('pt-BR')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const EmptyState = ({ message, action }: { message: string; action: string }) => (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
        <Car className="w-10 h-10 text-muted-foreground" />
      </div>
      <p className="text-xl text-muted-foreground mb-6">{message}</p>
      <Button onClick={() => navigate("/search")} size="lg">
        {action}
      </Button>
    </div>
  );

  return (
    <WebLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Minhas Reservas</h1>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <Tabs defaultValue="renter" className="w-full">
            <TabsList className="w-full max-w-md grid grid-cols-2 mb-8">
              <TabsTrigger value="renter" className="text-base py-3">Como motorista</TabsTrigger>
              <TabsTrigger value="owner" className="text-base py-3">Como locador</TabsTrigger>
            </TabsList>

            <TabsContent value="renter">
              {asRenter.length === 0 ? (
                <EmptyState
                  message="Você ainda não tem reservas ativas"
                  action="Buscar carros"
                />
              ) : (
                <div className="grid gap-6">
                  {asRenter.map((rental) => <RentalCard key={rental.id} rental={rental} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="owner">
              {asOwner.length === 0 ? (
                <EmptyState
                  message="Você ainda não tem reservas como locador"
                  action="Ver meus veículos"
                />
              ) : (
                <div className="grid gap-6">
                  {asOwner.map((rental) => <RentalCard key={rental.id} rental={rental} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </WebLayout>
  );
}
