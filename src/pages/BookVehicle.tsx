import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CNHVerificationModal } from "@/components/profile/CNHVerificationModal";
import { useDriverLicense } from "@/contexts/DriverLicenseContext";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { getVehicleById, getCurrentUser, createRental, OliVehicle, getProfile } from "@/lib/supabase";
import { notifyRentalRequest } from "@/lib/notificationService";
import { toast } from "sonner";
import { ArrowLeft, Car, AlertCircle, MapPin, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function BookVehicle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { licenseStatus } = useDriverLicense();
  const { isComplete: isProfileComplete, missingFields, loading: profileLoading } = useProfileCompletion();
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCNHModal, setShowCNHModal] = useState(false);

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

  const calculateRentalPrice = () => {
    if (!vehicle?.daily_price) return 0;
    const days = calculateDays();
    return days * vehicle.daily_price;
  };

  const calculateDriverTotal = () => {
    if (!vehicle?.has_driver_option || !withDriver) return 0;
    return calculateDays() * (vehicle.driver_daily_price || 0);
  };

  const calculateTotal = () => {
    const rentalPrice = calculateRentalPrice();
    const deposit = vehicle?.deposit_amount || 0;
    const driverTotal = calculateDriverTotal();
    return rentalPrice + deposit + driverTotal;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vehicle) return;

    // Check profile completion first
    if (!isProfileComplete) {
      toast.error("Complete seu perfil antes de fazer uma reserva");
      navigate("/profile/edit");
      return;
    }

    // Check CNH status before proceeding
    if (licenseStatus !== "approved") {
      setShowCNHModal(true);
      return;
    }

    if (!startDate || !endDate) {
      toast.error("Por favor, selecione as datas");
      return;
    }

    if (!pickupLocation || !dropoffLocation) {
      toast.error("Por favor, informe os locais de retirada e devoluÃ§Ã£o");
      return;
    }

    setLoading(true);

    const { user } = await getCurrentUser();
    if (!user) {
      toast.error("VocÃª precisa estar logado");
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
      with_driver: withDriver,
      driver_daily_rate: withDriver ? vehicle.driver_daily_price || 0 : 0,
      driver_total_amount: withDriver ? calculateDriverTotal() : 0,
      driver_license_verification_status: "not_started",
      notes: notes || null,
    });

    setLoading(false);

    if (rental) {
      toast.success("Reserva criada com sucesso!");
      
      // Notificar o proprietÃ¡rio por email
      const renterProfile = await getProfile(user.id);
      const vehicleTitle = vehicle.title || `${vehicle.brand} ${vehicle.model}`;
      notifyRentalRequest(
        vehicle.owner_id,
        renterProfile?.full_name || "Motorista",
        vehicleTitle,
        startDate,
        endDate,
        calculateTotal()
      );
      
      navigate("/reservations");
    } else {
      toast.error("Erro ao criar reserva");
    }
  };

  if (!vehicle) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </WebLayout>
    );
  }

  const vehicleTitle = vehicle.title || `${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""}`.trim();
  const days = calculateDays();
  const total = calculateTotal();

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </button>

        <h1 className="text-3xl font-bold mb-8">Fazer Reserva</h1>

        {/* Profile incomplete alert */}
        {!profileLoading && !isProfileComplete && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Perfil incompleto!</strong> Complete seus dados pessoais antes de fazer uma reserva.
              <br />
              <span className="text-sm">Campos faltando: {missingFields.join(", ")}</span>
              <Button
                variant="link"
                className="p-0 h-auto text-destructive-foreground underline ml-2"
                onClick={() => navigate("/profile/edit")}
              >
                Completar perfil
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vehicle Info */}
              <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
                <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                  <Car className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{vehicleTitle}</h2>
                  <p className="text-muted-foreground">
                    {vehicle.location_city} - {vehicle.location_state}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">PerÃ­odo</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Data de inÃ­cio</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-12",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(parse(startDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate ? parse(startDate, "yyyy-MM-dd", new Date()) : undefined}
                          onSelect={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                          locale={ptBR}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de tÃ©rmino</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-12",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(parse(endDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate ? parse(endDate, "yyyy-MM-dd", new Date()) : undefined}
                          onSelect={(date) => setEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                          locale={ptBR}
                          disabled={(date) => {
                            const minDate = startDate ? parse(startDate, "yyyy-MM-dd", new Date()) : new Date();
                            return date < minDate;
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Locations - Read only, defined by owner */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg">Local de Retirada e DevoluÃ§Ã£o</h3>
                <div className="bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium text-foreground">{pickupLocation || "A definir com o proprietÃ¡rio"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O local exato de retirada e devoluÃ§Ã£o serÃ¡ combinado diretamente com o proprietÃ¡rio apÃ³s a aprovaÃ§Ã£o da reserva.
                  </p>
                </div>
              </div>


              {vehicle.has_driver_option ? (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Modalidade da reserva</h3>
                  <p className="text-sm text-muted-foreground">
                    O locador disponibiliza este veiculo com ou sem motorista. Escolha abaixo como deseja seguir.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setWithDriver(false)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${!withDriver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <p className="font-semibold">Sem motorista</p>
                      <p className="text-sm text-muted-foreground">Use o valor base do anuncio.</p>
                      <p className="mt-3 text-lg font-bold text-primary">
                        {vehicle.daily_price ? `R$ ${vehicle.daily_price.toLocaleString("pt-BR")} / dia` : "Sob consulta"}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithDriver(true)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${withDriver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <p className="font-semibold">Com motorista do locador</p>
                      <p className="text-sm text-muted-foreground">Adicional cobrado pelo servico do motorista.</p>
                      <p className="mt-3 text-lg font-bold text-primary">
                        {vehicle.daily_price != null && vehicle.driver_daily_price != null
                          ? `R$ ${(vehicle.daily_price + vehicle.driver_daily_price).toLocaleString("pt-BR")} / dia`
                          : "Sob consulta"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Adicional: {vehicle.driver_daily_price != null ? `R$ ${vehicle.driver_daily_price.toLocaleString("pt-BR")} / dia` : "sob consulta"}
                      </p>
                    </button>
                  </div>

                  {vehicle.driver_notes ? (
                    <div className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
                      {vehicle.driver_notes}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {vehicle.mileage_limit_per_day ? (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
                  <h3 className="font-semibold text-lg">Limite de quilometragem</h3>
                  <p className="text-sm text-muted-foreground">
                    Este anuncio possui limite de {vehicle.mileage_limit_per_day} km por dia.
                  </p>
                  {days > 0 ? (
                    <p className="text-sm font-medium">Total previsto para o periodo selecionado: {days * vehicle.mileage_limit_per_day} km.</p>
                  ) : null}
                </div>
              ) : null}

              {/* Notes */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <Label htmlFor="notes">ObservaÃ§Ãµes (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alguma informaÃ§Ã£o adicional..."
                  className="mt-2"
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || days === 0 || !isProfileComplete}
                className="w-full h-14 text-lg"
                size="lg"
              >
                {loading ? "Criando reserva..." : "Confirmar reserva"}
              </Button>
            </form>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 sticky top-24">
              <h3 className="font-semibold text-lg">Resumo</h3>
              
              {days > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PerÃ­odo</span>
                    <span className="font-medium">{days} dia{days !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DiÃ¡ria</span>
                    <span className="font-medium">
                      R$ {vehicle.daily_price?.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal diÃ¡rias</span>
                    <span className="font-medium">
                      R$ {calculateRentalPrice().toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {withDriver && vehicle.has_driver_option ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Motorista</span>
                      <span className="font-medium">
                        R$ {calculateDriverTotal().toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ) : null}
                  {vehicle.deposit_amount ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CauÃ§Ã£o</span>
                      <span className="font-medium">
                        R$ {vehicle.deposit_amount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ) : null}
                  {vehicle.mileage_limit_per_day ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Limite de km</span>
                      <span className="font-medium">{days * vehicle.mileage_limit_per_day} km</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-4 border-t border-border">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {total.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Selecione as datas para ver o resumo
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <CNHVerificationModal open={showCNHModal} onOpenChange={setShowCNHModal} />
    </WebLayout>
  );
}


