import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getVehicleById, getCurrentUser, createRental, OliVehicle } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function BookVehicle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadVehicle(id);
    }
  }, [id]);

  const loadVehicle = async (vehicleId: string) => {
    const vehicleData = await getVehicleById(vehicleId);
    setVehicle(vehicleData);
    
    if (vehicleData?.location_city && vehicleData?.location_state) {
      const location = `${vehicleData.location_city} - ${vehicleData.location_state}`;
      setPickupLocation(location);
      setDropoffLocation(location);
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const calculateTotal = () => {
    if (!vehicle?.daily_price) return 0;
    const days = calculateDays();
    return days * vehicle.daily_price;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicle) return;

    if (!startDate || !endDate) {
      toast.error("Por favor, selecione as datas");
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      toast.error("Por favor, informe os locais de retirada e devolução");
      return;
    }

    setLoading(true);

    const { user } = await getCurrentUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      navigate("/auth");
      return;
    }

    const rental = await createRental({
      vehicle_id: vehicle.id,
      renter_id: user.id,
      owner_id: vehicle.owner_id,
      start_date: startDate,
      end_date: endDate,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      total_price: calculateTotal(),
      deposit_amount: vehicle.deposit_amount || 0,
      status: "pending_approval",
      notes: notes || null,
    });

    setLoading(false);

    if (rental) {
      toast.success("Reserva criada com sucesso!");
      navigate("/reservations");
    } else {
      toast.error("Erro ao criar reserva");
    }
  };

  if (!vehicle) {
    return (
      <MobileLayout showBottomNav={false}>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </MobileLayout>
    );
  }

  const vehicleTitle = vehicle.title || `${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""}`.trim();
  const days = calculateDays();
  const total = calculateTotal();

  return (
    <MobileLayout showBottomNav={false}>
      <div className="sticky top-0 bg-card border-b border-border z-10 p-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-secondary rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold">Fazer Reserva</h1>
      </div>

      <div className="p-4 space-y-6">
        <div className="card-elevated p-4">
          <h2 className="font-semibold mb-1">{vehicleTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {vehicle.location_city} - {vehicle.location_state}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data de início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data de término</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pickupLocation">Local de retirada</Label>
            <Input
              id="pickupLocation"
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="dropoffLocation">Local de devolução</Label>
            <Input
              id="dropoffLocation"
              type="text"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma informação adicional..."
              className="mt-1"
              rows={3}
            />
          </div>

          {days > 0 && (
            <div className="card-elevated p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Período</span>
                <span className="font-medium">{days} dia{days !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diária</span>
                <span className="font-medium">
                  R$ {vehicle.daily_price?.toLocaleString('pt-BR')}
                </span>
              </div>
              {vehicle.deposit_amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Caução</span>
                  <span className="font-medium">
                    R$ {vehicle.deposit_amount.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary text-lg">
                  R$ {total.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || days === 0}
            className="w-full btn-pill bg-primary hover:bg-primary/90 text-lg h-12"
          >
            {loading ? "Criando reserva..." : "Confirmar reserva"}
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
}
