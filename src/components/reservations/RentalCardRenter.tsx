import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { Calendar, MapPin, FileText, CreditCard, Clock, ClipboardCheck, Check, PenTool, Mail, ExternalLink, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getVehicleCoverPhoto } from "@/lib/supabase";
import { RentalContract } from "@/lib/contractService";
import { deriveContractStage, getContractStageLabel } from "@/components/contracts/ContractTimeline";
import { useContractRealtime } from "@/hooks/useContractRealtime";
import { useInspectionRealtime } from "@/hooks/useInspectionRealtime";
import { usePaymentRealtime } from "@/hooks/usePaymentRealtime";
import { InspectionTimeline } from "@/components/inspection/InspectionTimeline";

interface RentalCardRenterProps {
  rental: OliRental & { vehicle?: OliVehicle };
  onViewContract?: (contract: RentalContract | null) => void;
  onSignContract?: (contract: RentalContract) => void;
  onPay?: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Aguardando aprovação", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  active: { label: "Em uso", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function RentalCardRenter({ rental, onViewContract, onSignContract, onPay }: RentalCardRenterProps) {
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const { contract } = useContractRealtime(rental.id);
  const { inspections } = useInspectionRealtime(rental.id);
  const { hasPaid, paymentStatus } = usePaymentRealtime(rental.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (rental.vehicle_id) {
      getVehicleCoverPhoto(rental.vehicle_id).then(setCoverImage);
    }
  }, [rental.vehicle_id]);

  const vehicleTitle = rental.vehicle?.title || 
    `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim() ||
    "Veículo";

  const statusInfo = statusMap[rental.status] || { label: rental.status, variant: "secondary" as const };
  const isPending = rental.status === "pending_approval";
  const isApproved = rental.status === "approved";
  const isActive = rental.status === "active";

  const contractStage = deriveContractStage(contract);
  const bothSigned = contractStage === "both_signed" || contractStage === "inspection_released";
  const renterNeedsToSign = contract && (contractStage === "sent" || contractStage === "awaiting_renter");

  // Inspection checks
  const ownerInitialDone = inspections.some(
    (i) => i.inspection_stage === "owner_initial_inspection" && (i.status === "validated" || i.status === "completed")
  );
  const renterPickupDone = inspections.some(
    (i) => i.inspection_stage === "renter_pickup_inspection" && (i.status === "validated" || i.status === "completed")
  );
  const renterReturnDone = inspections.some(
    (i) => i.inspection_stage === "renter_return_inspection" && (i.status === "validated" || i.status === "completed")
  );

  const getContractBadge = () => {
    if (!contract) return null;
    switch (contractStage) {
      case "preparing":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Preparando</Badge>;
      case "sent":
        return <Badge variant="secondary" className="text-xs"><Mail className="w-3 h-3 mr-1" />Verifique seu e-mail</Badge>;
      case "renter_signed":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Aguardando proprietário</Badge>;
      case "both_signed":
        return <Badge variant="default" className="text-xs"><Check className="w-3 h-3 mr-1" />Assinado</Badge>;
      case "inspection_released":
        return <Badge variant="default" className="text-xs"><ClipboardCheck className="w-3 h-3 mr-1" />Vistoria liberada</Badge>;
      default:
        return null;
    }
  };

  // Determine renter's current action
  const getRenterAction = () => {
    if (isPending) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Aguardando aprovação do proprietário</span>
        </div>
      );
    }

    if (isApproved && !contract) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Aguardando contrato</span>
        </div>
      );
    }

    if (isApproved && renterNeedsToSign) {
      return (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewContract?.(contract)}>
            <FileText className="w-4 h-4 mr-2" />Ver Contrato
          </Button>
          <Button size="sm" onClick={() => window.open("https://app.clicksign.com", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />Assinar na Clicksign
          </Button>
        </div>
      );
    }

    // After owner initial inspection → renter pays
    if (bothSigned && ownerInitialDone && !renterPickupDone) {
      return (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewContract?.(contract)}>
            <FileText className="w-4 h-4 mr-2" />Contrato
          </Button>
          <Button size="sm" onClick={onPay}>
            <CreditCard className="w-4 h-4 mr-2" />Pagar
          </Button>
        </div>
      );
    }

    // After payment → renter does pickup inspection
    if (renterPickupDone && !renterReturnDone) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/reservations/${rental.id}/inspection?step=renter_return_inspection`)}
          className="gap-2"
        >
          <ClipboardCheck className="w-4 h-4" />Vistoria de Devolução
        </Button>
      );
    }

    if (renterReturnDone) {
      return (
        <span className="text-primary text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />Devolução registrada
        </span>
      );
    }

    if (bothSigned && !ownerInitialDone) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Aguardando vistoria do proprietário</span>
        </div>
      );
    }

    if (isApproved && contract) {
      return (
        <Button variant="outline" size="sm" onClick={() => onViewContract?.(contract)}>
          <FileText className="w-4 h-4 mr-2" />Ver Contrato
        </Button>
      );
    }

    return null;
  };

  

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-40 h-32 sm:h-auto bg-muted flex-shrink-0">
          {coverImage ? (
            <img src={coverImage} alt={vehicleTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Sem foto</span>
            </div>
          )}
        </div>

        <div className="flex-1 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base">{vehicleTitle}</h3>
              {rental.vehicle && (
                <p className="text-muted-foreground text-xs">
                  {rental.vehicle.location_city} - {rental.vehicle.location_state}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
              {getContractBadge()}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {format(new Date(rental.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                {format(new Date(rental.end_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            {rental.pickup_location && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{rental.pickup_location}</span>
              </div>
            )}
          </div>

          {/* Timeline with first 4 steps visible */}
          {(isApproved || isActive) && (
            <div className="border border-border rounded-lg p-3 bg-secondary/30">
              <InspectionTimeline
                contract={contract}
                inspections={inspections}
                rentalStatus={rental.status}
                hasPaid={hasPaid}
                paymentStatus={paymentStatus}
                initialVisible={4}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <span className="text-muted-foreground text-xs">Total</span>
              <p className="text-lg font-bold text-primary">
                R$ {rental.total_price?.toLocaleString('pt-BR') || '0'}
              </p>
            </div>
            {getRenterAction()}
          </div>
        </div>
      </div>
    </div>
  );
}
