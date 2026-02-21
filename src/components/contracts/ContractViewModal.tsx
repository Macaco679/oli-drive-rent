import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Send,
  Loader2,
  Check,
  PenTool,
  ShieldCheck,
  Download,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  ContractData,
  generateContractText,
  createContract,
  getContractByRentalId,
  RentalContract,
} from "@/lib/contractService";
import {
  getProfileById,
  getVehicleById,
  OliRental,
  OliVehicle,
  OliProfile,
  getCurrentUser,
} from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================================
// TYPES & HELPERS
// ============================================================

interface ContractViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  mode: "owner" | "renter";
  onContractSent?: () => void;
  onContractSign?: (contract: RentalContract) => void;
}

type ContractStatusKey = "pending" | "signed" | "cancelled";

interface ContractStatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
}

const CONTRACT_STATUS_MAP: Record<ContractStatusKey, ContractStatusConfig> = {
  pending: {
    label: "Pendente de assinatura",
    variant: "secondary",
    color: "bg-secondary text-secondary-foreground border-border",
  },
  signed: {
    label: "Contrato assinado",
    variant: "default",
    color: "bg-primary/10 text-primary border-primary/20",
  },
  cancelled: {
    label: "Assinatura não concluída",
    variant: "destructive",
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const WEBHOOK_URL = "https://n8n.srv1153225.hstgr.cloud/webhook/oli-contrato";

function generateEventId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDateBR(date: string | null): string {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

function formatCurrencyBR(value: number | null): string {
  if (value == null) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

// ============================================================
// WEBHOOK HELPER
// ============================================================

async function sendContractWebhook(payload: Record<string, unknown>): Promise<void> {
  try {
    console.log("[OLI Webhook] Enviando:", payload.event, payload);
    const resp = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[OLI Webhook] Status:", resp.status);
  } catch (err) {
    console.error("[OLI Webhook] Erro (não-bloqueante):", err);
  }
}

async function buildWebhookPayload(
  event: string,
  rental: OliRental & { vehicle?: OliVehicle },
  contract: RentalContract | null,
  owner: OliProfile | null,
  renter: OliProfile | null,
  currentUser: { id: string } | null,
  uiState: Record<string, unknown>,
  action?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const userRole =
    currentUser?.id === rental.owner_id
      ? "owner"
      : currentUser?.id === rental.renter_id
        ? "renter"
        : "unknown";

  const currentProfile = userRole === "owner" ? owner : renter;

  return {
    event,
    event_id: generateEventId(),
    timestamp: new Date().toISOString(),
    source: "lovable_frontend",
    page: "/reservations",
    environment: window.location.hostname.includes("localhost") ? "development" : "production",
    user: {
      id: currentUser?.id || null,
      role: userRole,
      name: currentProfile?.full_name || null,
      email: currentProfile?.email || null,
      phone: currentProfile?.phone || currentProfile?.whatsapp_phone || null,
    },
    reservation: {
      id: rental.id,
      status: rental.status,
      vehicle_id: rental.vehicle_id,
      renter_id: rental.renter_id,
      owner_id: rental.owner_id,
      start_date: rental.start_date,
      end_date: rental.end_date,
      pickup_location: rental.pickup_location,
      dropoff_location: rental.dropoff_location,
      total_price: rental.total_price,
      deposit_amount: rental.deposit_amount,
      notes: rental.notes,
      created_at: rental.created_at,
      updated_at: rental.updated_at,
    },
    contract: contract
      ? {
          id: contract.id,
          rental_id: contract.rental_id,
          status: contract.status,
          contract_num: contract.contract_number,
          version: contract.version,
          file_url: contract.file_url,
          renter_signed_at: contract.renter_signed_at,
          owner_signed_at: contract.owner_signed_at,
          provider: "clicksign",
          created_at: contract.created_at,
          updated_at: contract.updated_at,
        }
      : null,
    vehicle: rental.vehicle
      ? {
          id: rental.vehicle.id,
          title: rental.vehicle.title,
          brand: rental.vehicle.brand,
          model: rental.vehicle.model,
          year: rental.vehicle.year,
          plate: rental.vehicle.plate,
          color: rental.vehicle.color,
        }
      : null,
    ui: uiState,
    action: action || null,
  };
}

// ============================================================
// PROGRESS STEPS
// ============================================================

function ProgressSteps({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: "Contrato", icon: FileText },
    { label: "Assinatura", icon: PenTool },
    { label: "Vistoria", icon: ShieldCheck },
    { label: "Pagamento", icon: Check },
  ];

  return (
    <div className="flex items-center justify-between gap-1 px-2 py-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <div key={step.label} className="flex items-center gap-1 flex-1">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-1 transition-colors ${
                isDone
                  ? "bg-primary/10 text-primary"
                  : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// CONTRACT SUMMARY CARD
// ============================================================

function ContractSummary({
  rental,
  vehicle,
  owner,
  renter,
}: {
  rental: OliRental;
  vehicle?: OliVehicle | null;
  owner: OliProfile | null;
  renter: OliProfile | null;
}) {
  const vehicleLabel = vehicle
    ? `${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""}`.trim()
    : "—";
  const plate = vehicle?.plate || "—";

  const rows: { label: string; value: string }[] = [
    { label: "Locador", value: owner?.full_name || "—" },
    { label: "Locatário", value: renter?.full_name || "—" },
    { label: "Veículo", value: `${vehicleLabel} • ${plate}` },
    {
      label: "Período",
      value: `${formatDateBR(rental.start_date)} → ${formatDateBR(rental.end_date)}`,
    },
    { label: "Valor da locação", value: formatCurrencyBR(rental.total_price) },
    { label: "Caução", value: formatCurrencyBR(rental.deposit_amount) },
    { label: "Retirada", value: rental.pickup_location || "A definir" },
    { label: "Devolução", value: rental.dropoff_location || "A definir" },
  ];

  if (rental.notes) {
    rows.push({ label: "Observações", value: rental.notes });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Resumo do contrato
      </h4>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col text-sm">
            <span className="text-muted-foreground text-xs">{r.label}</span>
            <span className="font-medium">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function ContractViewModal({
  open,
  onOpenChange,
  rental,
  mode,
  onContractSent,
  onContractSign,
}: ContractViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);
  const [contractText, setContractText] = useState("");
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [owner, setOwner] = useState<OliProfile | null>(null);
  const [renter, setRenter] = useState<OliProfile | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const webhookSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && rental) {
      setAcknowledged(false);
      loadContractData();
    }
  }, [open, rental]);

  const loadContractData = async () => {
    if (!rental) return;
    setLoading(true);

    try {
      const [ownerData, renterData, existingContract, { user }] = await Promise.all([
        getProfileById(rental.owner_id),
        getProfileById(rental.renter_id),
        getContractByRentalId(rental.id),
        getCurrentUser(),
      ]);

      setOwner(ownerData);
      setRenter(renterData);
      setContract(existingContract);
      setCurrentUser(user ? { id: user.id } : null);

      if (ownerData && renterData && rental.vehicle) {
        const data: ContractData = {
          rental,
          vehicle: rental.vehicle,
          owner: ownerData,
          renter: renterData,
          contract: existingContract,
        };
        setContractText(generateContractText(data));
      }

      // Webhook: modal opened (once per open)
      if (webhookSentRef.current !== rental.id) {
        webhookSentRef.current = rental.id;
        const statusConfig = getStatusConfig(existingContract);
        sendContractWebhook(
          await buildWebhookPayload(
            "contract_modal_opened",
            rental,
            existingContract,
            ownerData,
            renterData,
            user ? { id: user.id } : null,
            {
              modal_status_label: statusConfig.label,
              has_contract_preview: true,
              has_contract_pdf: !!existingContract?.file_url,
            }
          )
        );
      }
    } catch (error) {
      console.error("Erro ao carregar dados do contrato:", error);
      toast.error("Erro ao carregar dados do contrato");
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (c: RentalContract | null): ContractStatusConfig => {
    if (!c) return CONTRACT_STATUS_MAP.pending;
    return CONTRACT_STATUS_MAP[c.status as ContractStatusKey] || CONTRACT_STATUS_MAP.pending;
  };

  const statusConfig = getStatusConfig(contract);
  const hasContract = contract !== null;
  const isSigned = hasContract && contract.renter_signed_at !== null;

  // Determine progress step
  const getProgressStep = (): number => {
    if (!hasContract) return 0;
    if (!isSigned) return 1;
    return 2; // signed → next is vistoria
  };

  // ============================================================
  // OWNER: Send contract
  // ============================================================
  const handleSendContract = async () => {
    if (!rental) return;
    setSending(true);

    try {
      const newContract = await createContract(rental.id);
      if (newContract) {
        setContract(newContract);
        toast.success("Contrato enviado com sucesso! O locatário poderá visualizar e assinar.");
        onContractSent?.();
      } else {
        toast.error("Erro ao enviar contrato");
      }
    } catch (error) {
      console.error("Erro ao enviar contrato:", error);
      toast.error("Erro ao enviar contrato");
    } finally {
      setSending(false);
    }
  };

  // ============================================================
  // RENTER: Sign with Clicksign
  // ============================================================
  const handleClicksignSign = async () => {
    if (!contract || !rental) return;
    setSigning(true);

    const uiState = {
      modal_status_label: statusConfig.label,
      cta_label: "Assinar com Clicksign",
      checkbox_acknowledged: acknowledged,
      has_contract_preview: true,
      has_contract_pdf: !!contract.file_url,
    };

    // Webhook: start requested
    sendContractWebhook(
      await buildWebhookPayload(
        "clicksign_start_requested",
        rental,
        contract,
        owner,
        renter,
        currentUser,
        uiState,
        { name: "click_sign_clicksign", result: "started", error_message: null }
      )
    );

    try {
      // For now, delegate to existing signature flow
      // When Clicksign integration is ready, replace with redirect logic
      onContractSign?.(contract);

      // Webhook: redirect ready (placeholder — Clicksign URL will come from backend)
      sendContractWebhook(
        await buildWebhookPayload(
          "clicksign_redirect_ready",
          rental,
          contract,
          owner,
          renter,
          currentUser,
          uiState,
          { name: "click_sign_clicksign", result: "redirect_ready", error_message: null }
        )
      );
    } catch (error) {
      console.error("Erro ao iniciar assinatura:", error);
      toast.error("Erro ao iniciar assinatura. Tente novamente.");

      sendContractWebhook(
        await buildWebhookPayload(
          "clicksign_start_failed",
          rental,
          contract,
          owner,
          renter,
          currentUser,
          uiState,
          { name: "click_sign_clicksign", result: "failed", error_message: String(error) }
        )
      );
    } finally {
      setSigning(false);
    }
  };

  if (!rental) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="w-5 h-5" />
            {mode === "owner" ? "Revisar e Enviar Contrato" : "Contrato de Locação"}
            <Badge className={`ml-1 text-xs border ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[60vh] px-6">
              <div className="space-y-4 pb-4">
                {/* Progress Steps */}
                <ProgressSteps currentStep={getProgressStep()} />

                {/* Clicksign Info Block (renter only, not signed) */}
                {mode === "renter" && !isSigned && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">
                          Assinatura digital segura via Clicksign
                        </p>
                        <p className="text-muted-foreground">
                          Ao continuar, você será redirecionado para concluir a assinatura eletrônica em ambiente seguro e certificado.
                        </p>
                        <p className="text-muted-foreground">
                          Após concluir, volte para esta página. O status será atualizado automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Signed success block */}
                {isSigned && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">
                        Contrato assinado em{" "}
                        {formatDateBR(contract.renter_signed_at)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Contract Summary */}
                <ContractSummary
                  rental={rental}
                  vehicle={rental.vehicle}
                  owner={owner}
                  renter={renter}
                />

                {/* PDF Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!contract?.file_url}
                    onClick={() => contract?.file_url && window.open(contract.file_url, "_blank")}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver contrato completo (PDF)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!contract?.file_url}
                    asChild={!!contract?.file_url}
                    className="gap-2"
                  >
                    {contract?.file_url ? (
                      <a href={contract.file_url} download>
                        <Download className="w-4 h-4" />
                        Baixar contrato (PDF)
                      </a>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Baixar contrato (PDF)
                      </>
                    )}
                  </Button>
                  {!contract?.file_url && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      PDF será disponibilizado após geração do contrato
                    </span>
                  )}
                </div>

                {/* Full contract text (collapsible) */}
                {contractText && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-primary font-medium flex items-center gap-1 py-1 hover:underline">
                      <FileText className="w-4 h-4" />
                      Ver texto completo do contrato
                    </summary>
                    <div className="mt-2 bg-secondary/30 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {contractText}
                    </div>
                  </details>
                )}
              </div>
            </ScrollArea>

            <Separator />

            {/* Footer */}
            <div className="px-6 py-4 space-y-3">
              {/* Checkbox — renter only, contract exists, not signed */}
              {mode === "renter" && hasContract && !isSigned && (
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <Checkbox
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-muted-foreground">
                    Li e estou ciente das principais condições da locação.
                  </span>
                </label>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
                {mode === "owner" ? (
                  <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Fechar
                    </Button>
                    <Button
                      onClick={handleSendContract}
                      disabled={sending}
                      className="gap-2"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : hasContract ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {hasContract ? "Reenviar Contrato" : "Enviar Contrato"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Fechar
                    </Button>
                    {hasContract && !isSigned && (
                      <Button
                        onClick={handleClicksignSign}
                        disabled={signing || !acknowledged}
                        className="gap-2"
                      >
                        {signing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Preparando assinatura...
                          </>
                        ) : (
                          <>
                            <PenTool className="w-4 h-4" />
                            Assinar com Clicksign
                          </>
                        )}
                      </Button>
                    )}
                    {isSigned && (
                      <Badge
                        variant="default"
                        className="px-4 py-2"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Contrato Assinado
                      </Badge>
                    )}
                  </>
                )}
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
