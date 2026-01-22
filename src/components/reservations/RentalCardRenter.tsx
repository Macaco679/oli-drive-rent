import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { Calendar, MapPin, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { getVehicleCoverPhoto } from "@/lib/supabase";

interface RentalCardRenterProps {
  rental: OliRental & { vehicle?: OliVehicle };
  onViewContract?: () => void;
  onPay?: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  active: { label: "Em uso", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function RentalCardRenter({ rental, onViewContract, onPay }: RentalCardRenterProps) {
  const [coverImage, setCoverImage] = useState<string | null>(null);

  useEffect(() => {
    if (rental.vehicle_id) {
      getVehicleCoverPhoto(rental.vehicle_id).then(setCoverImage);
    }
  }, [rental.vehicle_id]);

  const vehicleTitle = rental.vehicle?.title || 
    `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim() ||
    "Veículo";

  const statusInfo = statusMap[rental.status] || { label: rental.status, variant: "secondary" as const };
  const isApproved = rental.status === "approved";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col sm:flex-row">
        {/* Vehicle Image */}
        <div className="w-full sm:w-48 h-36 sm:h-auto bg-muted flex-shrink-0">
          {coverImage ? (
            <img
              src={coverImage}
              alt={vehicleTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Sem foto</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-xl">{vehicleTitle}</h3>
              {rental.vehicle && (
                <p className="text-muted-foreground text-sm">
                  {rental.vehicle.location_city} - {rental.vehicle.location_state}
                </p>
              )}
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>
                {format(new Date(rental.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                {format(new Date(rental.end_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            
            {rental.pickup_location && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{rental.pickup_location}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <span className="text-muted-foreground text-sm">Total</span>
              <p className="text-xl font-bold text-primary">
                R$ {rental.total_price?.toLocaleString('pt-BR') || '0'}
              </p>
            </div>

            {/* Actions for approved rentals */}
            {isApproved && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onViewContract}>
                  <FileText className="w-4 h-4 mr-2" />
                  Contrato
                </Button>
                <Button size="sm" onClick={onPay}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pagar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
