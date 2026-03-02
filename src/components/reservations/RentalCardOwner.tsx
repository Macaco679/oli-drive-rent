import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { Calendar, MapPin, ChevronRight, FileText, Check, ClipboardCheck, Download, Clock, PenTool } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getVehicleCoverPhoto } from "@/lib/supabase";
import { RentalContract } from "@/lib/contractService";
import { hasCompleteInspection } from "@/lib/inspectionService";
import { ContractTimeline, deriveContractStage, getContractStageLabel } from "@/components/contracts/ContractTimeline";
import { useContractRealtime } from "@/hooks/useContractRealtime";

interface RentalCardOwnerProps {
  rental: OliRental & { vehicle?: OliVehicle };
  onClick: () => void;
  onSendContract?: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  active: { label: "Em uso", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function RentalCardOwner({ rental, onClick, onSendContract }: RentalCardOwnerProps) {
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const { contract } = useContractRealtime(rental.id);
  const [hasPickupInspection, setHasPickupInspection] = useState(false);
  const [hasDropoffInspection, setHasDropoffInspection] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (rental.vehicle_id) {
      getVehicleCoverPhoto(rental.vehicle_id).then(setCoverImage);
    }
    checkInspections();
  }, [rental.vehicle_id, rental.id]);

  const checkInspections = async () => {
    const [pickup, dropoff] = await Promise.all([
      hasCompleteInspection(rental.id, "pickup"),
      hasCompleteInspection(rental.id, "dropoff"),
    ]);
    setHasPickupInspection(pickup);
    setHasDropoffInspection(dropoff);
  };

  const vehicleTitle = rental.vehicle?.title || 
    `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim() ||
    "Veículo";

  const statusInfo = statusMap[rental.status] || { label: rental.status, variant: "secondary" as const };
  const isPending = rental.status === "pending_approval";
  const isApproved = rental.status === "approved";
  const isActive = rental.status === "active";
  
  const contractStage = deriveContractStage(contract);
  const bothSigned = contractStage === "both_signed" || contractStage === "inspection_released";
  const inspectionReleased = contractStage === "inspection_released";

  const handleContractClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSendContract?.();
  };

  const handleInspectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/reservations/${rental.id}/inspection`);
  };

  const handleViewInspection = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/reservations/${rental.id}/inspection`);
  };

  // Determine the primary status badge for contract
  const getContractBadge = () => {
    if (!contract) return null;
    switch (contractStage) {
      case "preparing":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Preparando</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Aguardando locatário</Badge>;
      case "renter_signed":
        return <Badge variant="secondary" className="text-xs"><PenTool className="w-3 h-3 mr-1" />Falta sua assinatura</Badge>;
      case "owner_signed":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Aguardando locatário</Badge>;
      case "both_signed":
        return <Badge variant="default" className="text-xs"><Check className="w-3 h-3 mr-1" />Assinado</Badge>;
      case "inspection_released":
        return <Badge variant="default" className="text-xs"><ClipboardCheck className="w-3 h-3 mr-1" />Vistoria liberada</Badge>;
      default:
        return null;
    }
  };

  return (
    <div 
      className={`bg-card border rounded-2xl overflow-hidden transition-all cursor-pointer ${
        isPending ? "border-primary/50 hover:border-primary hover:shadow-lg" : "border-border hover:shadow-md"
      }`}
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Vehicle Image */}
        <div className="w-full sm:w-48 h-36 sm:h-auto bg-muted flex-shrink-0">
          {coverImage ? (
            <img src={coverImage} alt={vehicleTitle} className="w-full h-full object-cover" />
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              {getContractBadge()}
              {isActive && hasPickupInspection && (
                <Badge variant="default" className="text-xs">Vistoria OK</Badge>
              )}
              {isActive && hasDropoffInspection && (
                <Badge variant="outline" className="text-xs">Devolvido</Badge>
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
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

          {/* Contract Timeline - show when contract exists and rental is approved */}
          {isApproved && contract && (
            <div className="border border-border rounded-xl p-4 bg-secondary/30">
              <p className="text-sm font-medium mb-3 text-foreground">
                {getContractStageLabel(contractStage)}
              </p>
              <ContractTimeline contract={contract} />
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <span className="text-muted-foreground text-sm">Total</span>
              <p className="text-xl font-bold text-primary">
                R$ {rental.total_price?.toLocaleString('pt-BR') || '0'}
              </p>
            </div>

            {isPending && (
              <span className="text-primary font-medium text-sm">Clique para analisar →</span>
            )}

            {isApproved && !contract && (
              <Button size="sm" onClick={handleContractClick} className="gap-2">
                <FileText className="w-4 h-4" />
                Enviar Contrato
              </Button>
            )}

            {isApproved && contract && contractStage === "preparing" && (
              <span className="text-muted-foreground text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Contrato sendo preparado
              </span>
            )}

            {isApproved && contract && (contractStage === "sent" || contractStage === "owner_signed") && (
              <span className="text-muted-foreground text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Aguardando assinatura do locatário
              </span>
            )}

            {isApproved && contract && contractStage === "renter_signed" && (
              <span className="text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
                <PenTool className="w-4 h-4" />
                Assine o contrato →
              </span>
            )}

            {isApproved && bothSigned && !inspectionReleased && (
              <span className="text-muted-foreground text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Aguardando liberação da vistoria
              </span>
            )}

            {/* After payment (active) - owner does pickup inspection */}
            {isActive && !hasPickupInspection && (
              <Button size="sm" onClick={handleInspectionClick} className="gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Fazer Vistoria de Entrada
              </Button>
            )}

            {isActive && hasPickupInspection && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleViewInspection} className="gap-2">
                  <Download className="w-4 h-4" />
                  Ver Vistoria
                </Button>
                {hasDropoffInspection && (
                  <span className="text-primary text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Devolvido
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
