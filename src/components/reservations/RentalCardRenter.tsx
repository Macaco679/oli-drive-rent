import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { Calendar, MapPin, FileText, CreditCard, Clock, ClipboardCheck, Check, PenTool, Mail, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getVehicleCoverPhoto } from "@/lib/supabase";
import { getContractByRentalId, RentalContract } from "@/lib/contractService";
import { hasCompleteInspection } from "@/lib/inspectionService";
import { ContractTimeline, deriveContractStage, getContractStageLabel } from "@/components/contracts/ContractTimeline";

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
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [hasDropoffInspection, setHasDropoffInspection] = useState(false);
  const [hasPickupInspection, setHasPickupInspection] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (rental.vehicle_id) {
      getVehicleCoverPhoto(rental.vehicle_id).then(setCoverImage);
    }
    loadContract();
    checkInspections();
  }, [rental.vehicle_id, rental.id]);

  const loadContract = async () => {
    setLoadingContract(true);
    const contractData = await getContractByRentalId(rental.id);
    setContract(contractData);
    setLoadingContract(false);
  };

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
  const isApproved = rental.status === "approved";
  const isPending = rental.status === "pending_approval";
  const isActive = rental.status === "active";

  const contractStage = deriveContractStage(contract);
  const bothSigned = contractStage === "both_signed" || contractStage === "inspection_released";
  const renterNeedsToSign = contract && (contractStage === "sent" || contractStage === "awaiting_renter");
  const awaitingOwner = contractStage === "renter_signed";

  const handleDropoffInspection = () => {
    navigate(`/reservations/${rental.id}/inspection?kind=dropoff`);
  };

  const getContractBadge = () => {
    if (!contract) return null;
    switch (contractStage) {
      case "preparing":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Preparando</Badge>;
      case "sent":
        return <Badge variant="secondary" className="text-xs"><Mail className="w-3 h-3 mr-1" />Verifique seu e-mail</Badge>;
      case "renter_signed":
        return <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Aguardando proprietário</Badge>;
      case "owner_signed":
        return <Badge variant="secondary" className="text-xs"><Mail className="w-3 h-3 mr-1" />Verifique seu e-mail</Badge>;
      case "both_signed":
        return <Badge variant="default" className="text-xs"><Check className="w-3 h-3 mr-1" />Assinado</Badge>;
      case "inspection_released":
        return <Badge variant="default" className="text-xs"><ClipboardCheck className="w-3 h-3 mr-1" />Vistoria liberada</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
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
                <Badge variant="outline" className="text-xs">Vistoria OK</Badge>
              )}
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
              {renterNeedsToSign && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Verifique seu e-mail para assinar via Clicksign
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <span className="text-muted-foreground text-sm">Total</span>
              <p className="text-xl font-bold text-primary">
                R$ {rental.total_price?.toLocaleString('pt-BR') || '0'}
              </p>
            </div>

            {/* Pending - waiting for owner approval */}
            {isPending && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Aguardando aprovação do proprietário</span>
              </div>
            )}

            {/* Approved - show contract/payment actions */}
            {isApproved && (
              <div className="flex gap-2">
                {!contract ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Aguardando contrato</span>
                  </div>
                ) : renterNeedsToSign ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onViewContract?.(contract)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Ver Contrato
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => window.open("https://app.clicksign.com", "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Assinar na Clicksign
                    </Button>
                  </div>
                ) : awaitingOwner ? (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onViewContract?.(contract)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Ver Contrato
                    </Button>
                  </div>
                ) : bothSigned ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onViewContract?.(contract)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Ver Contrato
                    </Button>
                    <Button size="sm" onClick={onPay}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pagar
                    </Button>
                  </>
                ) : contractStage === "preparing" ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Contrato sendo preparado</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onViewContract?.(contract)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Contrato
                  </Button>
                )}
              </div>
            )}

            {/* Active - waiting for owner to do pickup inspection */}
            {isActive && !hasPickupInspection && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Aguardando vistoria do proprietário</span>
              </div>
            )}

            {/* Active with pickup inspection done */}
            {isActive && hasPickupInspection && (
              <div className="flex gap-2">
                {!hasDropoffInspection ? (
                  <Button size="sm" variant="outline" onClick={handleDropoffInspection} className="gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Vistoria de Devolução
                  </Button>
                ) : (
                  <span className="text-primary text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Devolução registrada
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
