import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  MapPin,
  PenTool,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deriveContractStage, getContractStageLabel } from "@/components/contracts/ContractTimeline";
import { InspectionTimeline } from "@/components/inspection/InspectionTimeline";
import { useContractRealtime } from "@/hooks/useContractRealtime";
import { useDepositRealtime } from "@/hooks/useDepositRealtime";
import { useInspectionRealtime } from "@/hooks/useInspectionRealtime";
import { usePaymentRealtime } from "@/hooks/usePaymentRealtime";
import { getVehicleCoverPhoto, OliRental, OliVehicle } from "@/lib/supabase";

interface RentalCardOwnerProps {
  rental: OliRental & { vehicle?: OliVehicle };
  onClick: () => void;
  onSendContract?: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  active: { label: "Em uso", variant: "default" },
  completed: { label: "Concluida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function RentalCardOwner({ rental, onClick, onSendContract }: RentalCardOwnerProps) {
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const { contract } = useContractRealtime(rental.id);
  const { inspections } = useInspectionRealtime(rental.id);
  const { hasPaid, paymentStatus } = usePaymentRealtime(rental.id);
  const { hasPaid: depositPaid, paymentStatus: depositStatus } = useDepositRealtime(rental.id, Boolean(rental.deposit_amount));
  const navigate = useNavigate();

  useEffect(() => {
    if (rental.vehicle_id) {
      getVehicleCoverPhoto(rental.vehicle_id).then(setCoverImage);
    }
  }, [rental.vehicle_id]);

  const vehicleTitle =
    rental.vehicle?.title ||
    `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim() ||
    "Veículo";

  const statusInfo = statusMap[rental.status] || { label: rental.status, variant: "secondary" as const };
  const isPending = rental.status === "pending_approval";
  const isApproved = rental.status === "approved";
  const isActive = rental.status === "active";
  const contractStage = deriveContractStage(contract);
  const bothSigned = contractStage === "both_signed" || contractStage === "inspection_released";
  const rentalLicenseStatus = (rental as { driver_license_verification_status?: string | null }).driver_license_verification_status || "not_started";
  const ownerInitialDone = inspections.some(
    (inspection) =>
      inspection.inspection_stage === "owner_initial_inspection" &&
      (inspection.status === "validated" || inspection.status === "completed"),
  );
  const ownerFinalDone = inspections.some(
    (inspection) =>
      inspection.inspection_stage === "owner_final_inspection" &&
      (inspection.status === "validated" || inspection.status === "completed"),
  );
  const renterPickupDone = inspections.some(
    (inspection) =>
      inspection.inspection_stage === "renter_pickup_inspection" &&
      (inspection.status === "validated" || inspection.status === "completed"),
  );
  const paymentConfirmed = hasPaid || ["paid", "confirmed", "received", "receveid"].includes((paymentStatus ?? "") as string);
  const requiresDeposit = Boolean((rental.deposit_amount || 0) > 0);
  const depositConfirmed = !requiresDeposit || depositPaid || ["paid", "confirmed", "received", "receveid"].includes((depositStatus ?? "") as string);

  const handleContractClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onSendContract?.();
  };

  const handleInspectionClick = (event: React.MouseEvent, step: string) => {
    event.stopPropagation();
    navigate(`/reservations/${rental.id}/inspection?step=${step}`);
  };

  const getContractBadge = () => {
    if (!contract) return null;

    switch (contractStage) {
      case "preparing":
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />Preparando
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />Aguardando locatario
          </Badge>
        );
      case "renter_signed":
        return (
          <Badge variant="secondary" className="text-xs">
            <PenTool className="w-3 h-3 mr-1" />Falta sua assinatura
          </Badge>
        );
      case "both_signed":
        return (
          <Badge variant="default" className="text-xs">
            <Check className="w-3 h-3 mr-1" />Assinado
          </Badge>
        );
      case "inspection_released":
        return (
          <Badge variant="default" className="text-xs">
            <ClipboardCheck className="w-3 h-3 mr-1" />Vistoria liberada
          </Badge>
        );
      default:
        return null;
    }
  };

  const getOwnerAction = () => {
    if (isPending) {
      return <span className="text-primary font-medium text-sm">Clique para analisar</span>;
    }

    if (isApproved && !contract) {
      if (rentalLicenseStatus !== "approved") {
        return (
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {rentalLicenseStatus === "pending"
              ? "CNH do locatario em validação"
              : "Aguardando validação da CNH do locatario"}
          </span>
        );
      }

      return (
        <Button size="sm" onClick={handleContractClick} className="gap-2">
          <FileText className="w-4 h-4" />Enviar contrato
        </Button>
      );
    }

    if (isApproved && contract && contractStage === "renter_signed") {
      return (
        <span className="text-amber-600 text-sm font-medium flex items-center gap-2">
          <PenTool className="w-4 h-4" />Assine o contrato
        </span>
      );
    }

    if (bothSigned && !ownerInitialDone) {
      return (
        <Button size="sm" onClick={(event) => handleInspectionClick(event, "owner_initial_inspection")} className="gap-2">
          <ClipboardCheck className="w-4 h-4" />Fazer vistoria inicial
        </Button>
      );
    }

    if (ownerInitialDone && !paymentConfirmed) {
      return (
        <span className="text-muted-foreground text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />Aguardando pagamento principal
        </span>
      );
    }

    if (ownerInitialDone && paymentConfirmed && requiresDeposit && !depositConfirmed && !renterPickupDone) {
      return (
        <span className="text-muted-foreground text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4" />Aguardando caucao Asaas do locatario
        </span>
      );
    }

    if (ownerInitialDone && paymentConfirmed && depositConfirmed && !renterPickupDone) {
      return (
        <span className="text-primary text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />Retirada liberada para o locatario
        </span>
      );
    }

    if (renterPickupDone && !ownerFinalDone) {
      return (
        <Button size="sm" onClick={(event) => handleInspectionClick(event, "owner_final_inspection")} className="gap-2">
          <ClipboardCheck className="w-4 h-4" />Vistoria final
        </Button>
      );
    }

    if (ownerInitialDone) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => handleInspectionClick(event, "owner_initial_inspection")}
          className="gap-2"
        >
          <Download className="w-4 h-4" />Ver vistoria
        </Button>
      );
    }

    if (isApproved && contract) {
      return (
        <span className="text-muted-foreground text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />{getContractStageLabel(contractStage)}
        </span>
      );
    }

    return null;
  };

  return (
    <div
      className={`bg-card border rounded-2xl overflow-hidden transition-all cursor-pointer ${
        isPending ? "border-primary/50 hover:border-primary hover:shadow-lg" : "border-border hover:shadow-md"
      }`}
      onClick={onClick}
    >
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
              <Badge variant={statusInfo.variant} className="text-xs">
                {statusInfo.label}
              </Badge>
              {getContractBadge()}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {format(new Date(rental.start_date), "dd/MM/yyyy", { locale: ptBR })} ate{" "}
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

          {(isApproved || isActive) && (
            <div className="border border-border rounded-lg p-3 bg-secondary/30">
              <InspectionTimeline
                contract={contract}
                inspections={inspections}
                rentalStatus={rental.status}
                hasPaid={hasPaid}
                paymentStatus={paymentStatus}
                requiresDeposit={requiresDeposit}
                depositStatus={depositStatus}
                renterLicenseStatus={rentalLicenseStatus}
                initialVisible={4}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border gap-4">
            <div>
              <span className="text-muted-foreground text-xs">Total</span>
              <p className="text-lg font-bold text-primary">R$ {rental.total_price?.toLocaleString("pt-BR") || "0"}</p>
              {requiresDeposit && (
                <p className="text-xs text-muted-foreground">
                  Caucao separada: R$ {rental.deposit_amount?.toLocaleString("pt-BR") || "0"}
                </p>
              )}
            </div>
            {getOwnerAction()}
          </div>
        </div>
      </div>
    </div>
  );
}
