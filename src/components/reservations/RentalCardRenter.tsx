import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deriveContractStage } from "@/components/contracts/ContractTimeline";
import { InspectionTimeline } from "@/components/inspection/InspectionTimeline";
import { useContractRealtime } from "@/hooks/useContractRealtime";
import { useDepositRealtime } from "@/hooks/useDepositRealtime";
import { useInspectionRealtime } from "@/hooks/useInspectionRealtime";
import { usePaymentRealtime } from "@/hooks/usePaymentRealtime";
import { RentalContract } from "@/lib/contractService";
import { getVehicleCoverPhoto, OliRental, OliVehicle } from "@/lib/supabase";

interface RentalCardRenterProps {
  rental: OliRental & { vehicle?: OliVehicle };
  onViewContract?: (contract: RentalContract | null) => void;
  onSignContract?: (contract: RentalContract) => void;
  onPay?: () => void;
  onDeposit?: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Aguardando aprovacao", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  active: { label: "Em uso", variant: "default" },
  completed: { label: "Concluida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function RentalCardRenter({ rental, onViewContract, onSignContract, onPay, onDeposit }: RentalCardRenterProps) {
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
  const renterNeedsToSign = contract && (contractStage === "sent" || contractStage === "awaiting_renter");
  const ownerInitialDone = inspections.some(
    (inspection) =>
      inspection.inspection_stage === "owner_initial_inspection" &&
      (inspection.status === "validated" || inspection.status === "completed"),
  );
  const renterPickupDone = inspections.some(
    (inspection) =>
      inspection.inspection_stage === "renter_pickup_inspection" &&
      (inspection.status === "validated" || inspection.status === "completed"),
  );
  const paymentConfirmed = hasPaid || ["paid", "confirmed", "received", "receveid"].includes((paymentStatus ?? "") as string);
  const rentalLicenseStatus = (rental as { driver_license_verification_status?: string | null }).driver_license_verification_status || "not_started";
  const rentalLicenseApproved = rentalLicenseStatus === "approved";
  const requiresDeposit = Boolean((rental.deposit_amount || 0) > 0);
  const depositConfirmed = !requiresDeposit || depositPaid || ["paid", "confirmed", "received", "receveid"].includes((depositStatus ?? "") as string);

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
          <Badge variant="secondary" className="text-xs">
            <Mail className="w-3 h-3 mr-1" />Verifique seu e-mail
          </Badge>
        );
      case "renter_signed":
        return (
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />Aguardando proprietario
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

  const getRenterAction = () => {
    if (isPending) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Aguardando aprovacao do proprietario</span>
        </div>
      );
    }

    if (isApproved && !rentalLicenseApproved) {
      if (rentalLicenseStatus === "pending") {
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Aguardando validação da CNH da reserva</span>
          </div>
        );
      }

      return (
        <Button size="sm" onClick={() => navigate(`/profile/driver-license?flow=rental&rentalId=${rental.id}`)} className="gap-2">
          <ShieldCheck className="w-4 h-4" />Validar CNH da reserva
        </Button>
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
            <FileText className="w-4 h-4 mr-2" />Ver contrato
          </Button>
          <Button size="sm" onClick={() => window.open("https://app.clicksign.com", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />Assinar na Clicksign
          </Button>
        </div>
      );
    }

    if (bothSigned && !ownerInitialDone) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Aguardando vistoria do proprietario</span>
        </div>
      );
    }

    if (bothSigned && ownerInitialDone && !paymentConfirmed && !renterPickupDone) {
      return (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewContract?.(contract)}>
            <FileText className="w-4 h-4 mr-2" />Contrato
          </Button>
          <Button size="sm" onClick={onPay}>
            <CreditCard className="w-4 h-4 mr-2" />Pagar reserva
          </Button>
        </div>
      );
    }

    if (bothSigned && ownerInitialDone && paymentConfirmed && requiresDeposit && !depositConfirmed && !renterPickupDone) {
      if (depositStatus === "pending") {
        return (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDeposit}>
              <Building2 className="w-4 h-4 mr-2" />Ver caucao Asaas
            </Button>
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />Aguardando pagamento da caucao
            </span>
          </div>
        );
      }

      return (
        <Button size="sm" onClick={onDeposit} className="gap-2">
          <Building2 className="w-4 h-4" />Pagar caucao via Asaas
        </Button>
      );
    }

    if (bothSigned && ownerInitialDone && paymentConfirmed && depositConfirmed && !renterPickupDone) {
      return (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewContract?.(contract)}>
            <FileText className="w-4 h-4 mr-2" />Contrato
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/reservations/${rental.id}/inspection?step=renter_pickup_inspection`)}
            className="gap-2"
          >
            <ClipboardCheck className="w-4 h-4" />Iniciar vistoria de retirada
          </Button>
        </div>
      );
    }

    if (renterPickupDone) {
      return (
        <span className="text-primary text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />Retirada registrada, aguardando vistoria final
        </span>
      );
    }

    if (isApproved && contract) {
      return (
        <Button variant="outline" size="sm" onClick={() => onViewContract?.(contract)}>
          <FileText className="w-4 h-4 mr-2" />Ver contrato
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
              <Badge variant={statusInfo.variant} className="text-xs">
                {statusInfo.label}
              </Badge>
              {getContractBadge()}
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
            {getRenterAction()}
          </div>
        </div>
      </div>
    </div>
  );
}
