import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Calendar,
  Check,
  FileText,
  Mail,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react";
import {
  OliProfile,
  OliRental,
  OliVehicle,
  getProfileById,
  getVehicleCoverPhoto,
  updateRentalStatus,
} from "@/lib/supabase";
import { notifyRentalApproved, notifyRentalRejected } from "@/lib/notificationService";
import { useDepositRealtime } from "@/hooks/useDepositRealtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface RentalDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  onStatusChange: () => void;
  onSendContract?: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  active: { label: "Em uso", variant: "default" },
  completed: { label: "Concluida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export function RentalDetailsModal({ open, onOpenChange, rental, onStatusChange, onSendContract }: RentalDetailsModalProps) {
  const [renter, setRenter] = useState<OliProfile | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { hasPaid: depositPaid, paymentStatus: depositStatus } = useDepositRealtime(rental?.id, Boolean(rental?.deposit_amount));

  useEffect(() => {
    if (rental?.renter_id) {
      getProfileById(rental.renter_id).then(setRenter);
    }
    if (rental?.vehicle_id) {
      getVehicleCoverPhoto(rental.vehicle_id).then(setCoverImage);
    }
  }, [rental]);

  if (!rental) return null;

  const vehicleTitle =
    rental.vehicle?.title ||
    `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim() ||
    "Veiculo";

  const statusInfo = statusMap[rental.status] || { label: rental.status, variant: "secondary" as const };
  const isPending = rental.status === "pending_approval";
  const isApproved = rental.status === "approved";
  const requiresDeposit = Boolean((rental.deposit_amount || 0) > 0);
  const depositLabel = !requiresDeposit
    ? "Nao se aplica"
    : depositPaid
      ? "Garantida"
      : depositStatus === "pending"
        ? "Aguardando pagamento"
        : depositStatus === "failed"
          ? "Falhou"
          : "Nao iniciada";

  const handleApprove = async () => {
    setLoading(true);
    const success = await updateRentalStatus(rental.id, "approved");
    setLoading(false);

    if (success) {
      toast.success("Reserva aprovada! O locatario precisara concluir a validacao de CNH desta reserva antes do contrato.");
      notifyRentalApproved(
        rental.renter_id,
        vehicleTitle,
        format(new Date(rental.start_date), "dd/MM/yyyy"),
        format(new Date(rental.end_date), "dd/MM/yyyy"),
      );
      onStatusChange();
      onOpenChange(false);
    } else {
      toast.error("Erro ao aprovar reserva");
    }
  };

  const handleReject = async () => {
    setLoading(true);
    const success = await updateRentalStatus(rental.id, "cancelled");
    setLoading(false);

    if (success) {
      toast.success("Reserva recusada");
      notifyRentalRejected(
        rental.renter_id,
        vehicleTitle,
        format(new Date(rental.start_date), "dd/MM/yyyy"),
        format(new Date(rental.end_date), "dd/MM/yyyy"),
      );
      onStatusChange();
      onOpenChange(false);
    } else {
      toast.error("Erro ao recusar reserva");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Detalhes da reserva</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-32 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
              {coverImage ? (
                <img src={coverImage} alt={vehicleTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{vehicleTitle}</h3>
              <p className="text-muted-foreground text-sm">
                {rental.vehicle?.location_city} - {rental.vehicle?.location_state}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(rental.start_date), "dd/MM/yyyy", { locale: ptBR })} ate{" "}
                  {format(new Date(rental.end_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Dados do locatario
            </h4>
            {renter ? (
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nome completo</span>
                  <span className="font-medium">{renter.full_name || "Nao informado"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </span>
                  <span className="font-medium">{renter.email || "Nao informado"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </span>
                  <span className="font-medium">{renter.phone || renter.whatsapp_phone || "Nao informado"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CPF</span>
                  <span className="font-medium">{renter.cpf || "Nao informado"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Data de nascimento</span>
                  <span className="font-medium">
                    {renter.birth_date ? format(new Date(renter.birth_date), "dd/MM/yyyy", { locale: ptBR }) : "Nao informado"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Carregando dados do locatario...</p>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Locais de retirada e devolucao
            </h4>
            <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Retirada</span>
                <span className="font-medium">{rental.pickup_location || "A definir"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Devolucao</span>
                <span className="font-medium">{rental.dropoff_location || "A definir"}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs mt-2">
              Os locais sao definidos pelo proprietario em comum acordo com o cliente.
            </p>
          </div>

          <Separator />

          <div className="bg-primary/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg">Total da reserva</span>
              <span className="text-2xl font-bold text-primary">R$ {rental.total_price?.toLocaleString("pt-BR") || "0"}</span>
            </div>
            {requiresDeposit && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Caucao via Asaas</span>
                  <span>R$ {rental.deposit_amount?.toLocaleString("pt-BR") || "0"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status da caucao</span>
                  <Badge variant={depositPaid ? "default" : depositStatus === "pending" ? "secondary" : "outline"}>{depositLabel}</Badge>
                </div>
              </>
            )}
          </div>

          {requiresDeposit && (
            <div className="rounded-xl border p-4 bg-secondary/30">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Fluxo da caucao</p>
                  <p className="text-sm text-muted-foreground">
                    A caucao e separada do pagamento principal. O valor fica retido ate a devolucao do veiculo e so pode
                    ser liberado apos vistoria final, aval do locador e aval da OLI.
                  </p>
                </div>
              </div>
            </div>
          )}

          {rental.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Observacoes do cliente</h4>
                <p className="text-muted-foreground bg-secondary/50 rounded-xl p-4">{rental.notes}</p>
              </div>
            </>
          )}

          {isPending && (
            <div className="flex gap-3 pt-4">
              <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={loading}>
                <X className="w-4 h-4 mr-2" />
                Recusar
              </Button>
              <Button className="flex-1" onClick={handleApprove} disabled={loading}>
                <Check className="w-4 h-4 mr-2" />
                Aprovar reserva
              </Button>
            </div>
          )}

          {isApproved && (
            <div className="space-y-3 pt-4">
              <Button variant="outline" className="w-full" onClick={onSendContract}>
                <FileText className="w-4 h-4 mr-2" />
                Revisar e enviar contrato
              </Button>
              <p className="text-xs text-muted-foreground">
                O pagamento principal e a caucao via Asaas aparecem no fluxo do locatario, em etapas separadas.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
