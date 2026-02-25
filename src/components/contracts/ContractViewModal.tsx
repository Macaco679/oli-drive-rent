import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Info,
  RefreshCw,
  Clock,
  AlertTriangle,
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
  OliRental,
  OliVehicle,
  OliProfile,
  getCurrentUser,
} from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ============================================================
// ADDRESS & CPF TYPES
// ============================================================

interface UserAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

interface EnrichedParty {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
}

function sanitizeCpf(cpf: string | null): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

function sanitizeZip(zip: string | null): string {
  if (!zip) return "";
  return zip.replace(/\D/g, "");
}

function sanitizeState(state: string | null): string {
  if (!state) return "";
  return state.trim().toUpperCase().slice(0, 2);
}

async function fetchUserAddress(userId: string): Promise<UserAddress | null> {
  const { data, error } = await supabase
    .from("oli_user_addresses")
    .select("street, number, complement, neighborhood, city, state, postal_code, is_default, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

function validatePartyData(
  profile: OliProfile | null,
  address: UserAddress | null,
  role: string
): string[] {
  const missing: string[] = [];
  if (!profile?.cpf || sanitizeCpf(profile.cpf).length < 11) missing.push(`${role}: CPF`);
  if (!profile?.email) missing.push(`${role}: E-mail`);
  if (!address) {
    missing.push(`${role}: Endereço completo`);
  } else {
    if (!address.street) missing.push(`${role}: Logradouro`);
    if (!address.number) missing.push(`${role}: Número`);
    if (!address.neighborhood) missing.push(`${role}: Bairro`);
    if (!address.city) missing.push(`${role}: Cidade`);
    if (!address.state) missing.push(`${role}: Estado (UF)`);
    if (!address.postal_code || sanitizeZip(address.postal_code).length < 8) missing.push(`${role}: CEP`);
  }
  return missing;
}

function buildEnrichedParty(
  profile: OliProfile,
  address: UserAddress
): EnrichedParty {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone || profile.whatsapp_phone || null,
    cpf: sanitizeCpf(profile.cpf),
    address: {
      street: address.street || "",
      number: address.number || "",
      complement: address.complement || "",
      neighborhood: address.neighborhood || "",
      city: address.city || "",
      state: sanitizeState(address.state),
      zip: sanitizeZip(address.postal_code),
    },
  };
}

// ============================================================
// TYPES & HELPERS
// ============================================================

interface ContractViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  mode: "owner" | "renter";
  onContractSent?: () => void;
  /** @deprecated Clicksign handles signing externally. This callback is no longer used. */
  onContractSign?: (contract: RentalContract) => void;
}

// Derive a richer UI status from DB fields
type ContractUIStatus =
  | "no_contract"
  | "pending"
  | "awaiting_renter"
  | "awaiting_owner"
  | "signed"
  | "cancelled";

interface ContractStatusConfig {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
  icon: typeof Clock;
}

const CONTRACT_UI_STATUS: Record<ContractUIStatus, ContractStatusConfig> = {
  no_contract: {
    label: "Pendente de assinatura",
    variant: "secondary",
    color: "bg-secondary text-secondary-foreground border-border",
    icon: Clock,
  },
  pending: {
    label: "Pendente de assinatura",
    variant: "secondary",
    color: "bg-secondary text-secondary-foreground border-border",
    icon: Clock,
  },
  awaiting_renter: {
    label: "Aguardando assinatura do locatário",
    variant: "outline",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  awaiting_owner: {
    label: "Aguardando assinatura do proprietário",
    variant: "outline",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: Clock,
  },
  signed: {
    label: "Contrato assinado",
    variant: "default",
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Check,
  },
  cancelled: {
    label: "Assinatura não concluída",
    variant: "destructive",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertTriangle,
  },
};

function deriveUIStatus(contract: RentalContract | null): ContractUIStatus {
  if (!contract) return "no_contract";
  if (contract.status === "cancelled") return "cancelled";
  if (contract.status === "signed") return "signed";
  // status === "pending" — check individual signatures
  if (contract.renter_signed_at && contract.owner_signed_at) return "signed";
  if (contract.renter_signed_at && !contract.owner_signed_at) return "awaiting_owner";
  return "awaiting_renter";
}

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

// Webhook is sent via the Supabase Edge Function proxy to avoid CORS issues
async function sendContractWebhook(payload: Record<string, unknown>): Promise<void> {
  try {
    console.log("[OLI Webhook] Enviando via proxy:", payload.event, payload);
    const { data, error } = await supabase.functions.invoke("webhook-proxy", {
      body: { ...payload, _webhook_target: "oli-contrato" },
    });
    if (error) {
      console.error("[OLI Webhook] Erro proxy:", error);
    } else {
      console.log("[OLI Webhook] Sucesso:", data);
    }
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
  action?: Record<string, unknown>,
  ownerAddr?: UserAddress | null,
  renterAddr?: UserAddress | null
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
          pickup_address: {
            street: rental.vehicle.pickup_street || "",
            number: rental.vehicle.pickup_number || "",
            complement: rental.vehicle.pickup_complement || "",
            neighborhood: rental.vehicle.pickup_neighborhood || "",
            city: rental.vehicle.location_city || "",
            state: rental.vehicle.location_state || "",
            zip: rental.vehicle.pickup_zip_code || "",
          },
        }
      : null,
    owner_profile: owner
      ? {
          id: owner.id,
          full_name: owner.full_name,
          email: owner.email,
          phone: owner.phone,
          whatsapp_phone: owner.whatsapp_phone,
          cpf: owner.cpf,
          rg: owner.rg,
          birth_date: owner.birth_date,
          nationality: owner.nationality,
          marital_status: owner.marital_status,
          profession: owner.profession,
          address: ownerAddr ? {
            street: ownerAddr.street || "",
            number: ownerAddr.number || "",
            complement: ownerAddr.complement || "",
            neighborhood: ownerAddr.neighborhood || "",
            city: ownerAddr.city || "",
            state: sanitizeState(ownerAddr.state),
            zip: sanitizeZip(ownerAddr.postal_code),
          } : null,
        }
      : null,
    renter_profile: renter
      ? {
          id: renter.id,
          full_name: renter.full_name,
          email: renter.email,
          phone: renter.phone,
          whatsapp_phone: renter.whatsapp_phone,
          cpf: renter.cpf,
          rg: renter.rg,
          birth_date: renter.birth_date,
          nationality: renter.nationality,
          marital_status: renter.marital_status,
          profession: renter.profession,
          address: renterAddr ? {
            street: renterAddr.street || "",
            number: renterAddr.number || "",
            complement: renterAddr.complement || "",
            neighborhood: renterAddr.neighborhood || "",
            city: renterAddr.city || "",
            state: sanitizeState(renterAddr.state),
            zip: sanitizeZip(renterAddr.postal_code),
          } : null,
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
}: ContractViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);
  const [contractText, setContractText] = useState("");
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [owner, setOwner] = useState<OliProfile | null>(null);
  const [renter, setRenter] = useState<OliProfile | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<UserAddress | null>(null);
  const [renterAddress, setRenterAddress] = useState<UserAddress | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const webhookSentRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && rental) {
      setAcknowledged(false);
      loadContractData();
    }
    return () => stopPolling();
  }, [open, rental]);

  // Poll for status updates while modal is open (every 10s)
  useEffect(() => {
    if (open && rental) {
      pollingRef.current = setInterval(() => {
        refreshContractStatus();
      }, 10000);
    }
    return () => stopPolling();
  }, [open, rental?.id]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const refreshContractStatus = useCallback(async () => {
    if (!rental) return;
    const updated = await getContractByRentalId(rental.id);
    if (updated) {
      setContract(updated);
    }
  }, [rental]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshContractStatus();
    setRefreshing(false);
    toast.info("Status atualizado");
  };

  const loadContractData = async () => {
    if (!rental) return;
    setLoading(true);

    try {
      const [ownerData, renterData, existingContract, { user }, ownerAddr, renterAddr] = await Promise.all([
        getProfileById(rental.owner_id),
        getProfileById(rental.renter_id),
        getContractByRentalId(rental.id),
        getCurrentUser(),
        fetchUserAddress(rental.owner_id),
        fetchUserAddress(rental.renter_id),
      ]);

      setOwner(ownerData);
      setRenter(renterData);
      setContract(existingContract);
      setCurrentUser(user ? { id: user.id } : null);
      setOwnerAddress(ownerAddr);
      setRenterAddress(renterAddr);

      // Validate required fields
      const missing = [
        ...validatePartyData(renterData, renterAddr, "Locatário"),
        ...validatePartyData(ownerData, ownerAddr, "Locador"),
      ];
      setMissingFields(missing);
      if (missing.length > 0) {
        console.warn("[OLI] Campos obrigatórios faltando:", missing);
      }

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

      // No webhook on modal open — only on explicit user actions (contract_sent, clicksign_start)
    } catch (error) {
      console.error("Erro ao carregar dados do contrato:", error);
      toast.error("Erro ao carregar dados do contrato");
    } finally {
      setLoading(false);
    }
  };

  const uiStatus = deriveUIStatus(contract);
  const statusConfig = CONTRACT_UI_STATUS[uiStatus];
  const hasContract = contract !== null;
  const isFullySigned = uiStatus === "signed";
  const canSign = mode === "renter" && hasContract && uiStatus === "awaiting_renter";
  const dataComplete = missingFields.length === 0;

  // Determine progress step
  const getProgressStep = (): number => {
    if (!hasContract) return 0;
    if (uiStatus === "awaiting_renter" || uiStatus === "pending") return 1;
    if (uiStatus === "awaiting_owner") return 1;
    if (isFullySigned) return 2;
    return 0;
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

        // Send webhook with enriched data when owner sends contract
        const enrichedPayload: Record<string, unknown> = {
          event: "contract_sent",
          event_id: generateEventId(),
          timestamp: new Date().toISOString(),
          source: "lovable_frontend",
          page: "/reservations",
          environment: window.location.hostname.includes("localhost") ? "development" : "production",
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
          },
          contract: {
            id: newContract.id,
            rental_id: newContract.rental_id,
            status: newContract.status,
            contract_num: newContract.contract_number,
            version: newContract.version,
            file_url: newContract.file_url,
            renter_signed_at: newContract.renter_signed_at,
            owner_signed_at: newContract.owner_signed_at,
            provider: "clicksign",
            created_at: newContract.created_at,
            updated_at: newContract.updated_at,
          },
          vehicle: rental.vehicle
            ? {
                id: rental.vehicle.id,
                title: rental.vehicle.title,
                brand: rental.vehicle.brand,
                model: rental.vehicle.model,
                year: rental.vehicle.year,
                plate: rental.vehicle.plate,
                color: rental.vehicle.color,
                pickup_address: {
                  street: rental.vehicle.pickup_street || "",
                  number: rental.vehicle.pickup_number || "",
                  complement: rental.vehicle.pickup_complement || "",
                  neighborhood: rental.vehicle.pickup_neighborhood || "",
                  city: rental.vehicle.location_city || "",
                  state: rental.vehicle.location_state || "",
                  zip: rental.vehicle.pickup_zip_code || "",
                },
              }
            : null,
          renter: renter && renterAddress
            ? buildEnrichedParty(renter, renterAddress)
            : { id: rental.renter_id, name: renter?.full_name, email: renter?.email, phone: renter?.phone },
          owner: owner && ownerAddress
            ? buildEnrichedParty(owner, ownerAddress)
            : { id: rental.owner_id, name: owner?.full_name, email: owner?.email, phone: owner?.phone },
        };
        sendContractWebhook(enrichedPayload);

        toast.success("Contrato enviado! O locatário poderá visualizar e assinar via Clicksign.");
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
  // RENTER: Initiate Clicksign signing (NO local signing)
  // ============================================================
  const handleClicksignSign = async () => {
    if (!contract || !rental || !owner || !renter || !ownerAddress || !renterAddress) return;
    if (missingFields.length > 0) {
      toast.error("Complete os dados obrigatórios antes de assinar.");
      console.error("[OLI] Bloqueando assinatura — campos faltando:", missingFields);
      return;
    }
    setSigning(true);

    const enrichedRenter = buildEnrichedParty(renter, renterAddress);
    const enrichedOwner = buildEnrichedParty(owner, ownerAddress);

    const fullPayload: Record<string, unknown> = {
      event: "clicksign_start",
      event_id: generateEventId(),
      timestamp: new Date().toISOString(),
      source: "lovable_frontend",
      page: "/reservations",
      environment: window.location.hostname.includes("localhost") ? "development" : "production",
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
      contract: {
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
      },
      vehicle: rental.vehicle
        ? {
            id: rental.vehicle.id,
            title: rental.vehicle.title,
            brand: rental.vehicle.brand,
            model: rental.vehicle.model,
            year: rental.vehicle.year,
            plate: rental.vehicle.plate,
            color: rental.vehicle.color,
            pickup_address: {
              street: rental.vehicle.pickup_street || "",
              number: rental.vehicle.pickup_number || "",
              complement: rental.vehicle.pickup_complement || "",
              neighborhood: rental.vehicle.pickup_neighborhood || "",
              city: rental.vehicle.location_city || "",
              state: rental.vehicle.location_state || "",
              zip: rental.vehicle.pickup_zip_code || "",
            },
          }
        : null,
      renter: enrichedRenter,
      owner: enrichedOwner,
      ui: {
        checkbox_acknowledged: acknowledged,
        modal_status_label: statusConfig.label,
        cta_label: "Assinar com Clicksign",
        has_contract_preview: true,
        has_contract_pdf: !!contract.file_url,
      },
    };

    try {
      // Send the enriched payload via proxy
      await sendContractWebhook(fullPayload);

      toast.info(
        "Solicitação de assinatura enviada. Aguarde o redirecionamento para a Clicksign.",
        { duration: 5000 }
      );
    } catch (error) {
      console.error("Erro ao iniciar assinatura:", error);
      toast.error("Erro ao iniciar assinatura. Tente novamente.");
    } finally {
      setSigning(false);
    }
  };

  if (!rental) return null;

  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="w-5 h-5" />
            {mode === "owner" ? "Revisar e Enviar Contrato" : "Contrato de Locação"}
            <Badge className={`ml-1 text-xs border ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
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

                {/* Clicksign Info Block (renter only, not fully signed) */}
                {mode === "renter" && !isFullySigned && uiStatus !== "cancelled" && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">
                          Assinatura digital segura via Clicksign
                        </p>
                        <p className="text-muted-foreground">
                          A assinatura jurídica deste contrato é feita exclusivamente via Clicksign, em ambiente seguro e certificado.
                        </p>
                        <p className="text-muted-foreground">
                          Ao continuar, você será redirecionado para concluir a assinatura eletrônica. O contrato só será considerado assinado após confirmação da Clicksign.
                        </p>
                        <p className="text-muted-foreground">
                          Após concluir, volte para esta página. O status será atualizado automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Missing fields warning */}
                {canSign && !dataComplete && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">
                          Complete seus dados para assinar
                        </p>
                        <p className="text-muted-foreground">
                          Para iniciar a assinatura, é necessário que locatário e locador tenham CPF e endereço completos cadastrados.
                        </p>
                        <ul className="list-disc ml-4 text-muted-foreground text-xs space-y-0.5">
                          {missingFields.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1"
                          onClick={() => window.open("/profile/edit", "_blank")}
                        >
                          Atualizar dados
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Awaiting owner signature */}
                {uiStatus === "awaiting_owner" && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex items-start gap-2 text-sm">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          Locatário assinou — aguardando proprietário
                        </p>
                        <p className="text-muted-foreground">
                          O proprietário será notificado por e-mail para assinar o contrato via Clicksign. Após a assinatura de ambas as partes, a reserva ficará pronta para vistoria e pagamento.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fully signed success */}
                {isFullySigned && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Check className="w-5 h-5" />
                      <div>
                        <span className="font-medium">
                          Contrato assinado por ambas as partes
                        </span>
                        <span className="text-muted-foreground ml-2">
                          — Pronto para vistoria e pagamento
                        </span>
                      </div>
                    </div>
                    {contract?.renter_signed_at && (
                      <p className="text-xs text-muted-foreground ml-7 mt-1">
                        Locatário: {formatDateBR(contract.renter_signed_at)}
                        {contract.owner_signed_at && ` • Proprietário: ${formatDateBR(contract.owner_signed_at)}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Cancelled/error */}
                {uiStatus === "cancelled" && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">
                        A assinatura deste contrato não foi concluída ou foi cancelada.
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

                {/* Refresh status button */}
                {hasContract && !isFullySigned && uiStatus !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="gap-2 text-muted-foreground"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    Atualizar status
                  </Button>
                )}

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
              {/* Checkbox — renter only, can sign */}
              {canSign && (
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
                    {canSign && (
                      <Button
                        onClick={handleClicksignSign}
                        disabled={signing || !acknowledged || !dataComplete}
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
                    {isFullySigned && (
                      <Badge variant="default" className="px-4 py-2">
                        <Check className="w-4 h-4 mr-2" />
                        Contrato Assinado
                      </Badge>
                    )}
                    {uiStatus === "awaiting_owner" && (
                      <Badge variant="outline" className="px-4 py-2 border-blue-500/20 text-blue-700 dark:text-blue-400">
                        <Clock className="w-4 h-4 mr-2" />
                        Aguardando proprietário
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
