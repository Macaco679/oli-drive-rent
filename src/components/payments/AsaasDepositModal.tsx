import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { useContractRealtime } from "@/hooks/useContractRealtime";
import { useDepositRealtime } from "@/hooks/useDepositRealtime";
import { useInspectionRealtime } from "@/hooks/useInspectionRealtime";
import { usePaymentRealtime } from "@/hooks/usePaymentRealtime";
import { deriveContractStage } from "@/components/contracts/ContractTimeline";
import { toast } from "sonner";

interface AsaasDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  onDepositComplete?: () => void;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
};

const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
};

const mapProviderStatus = (rawValue: string | null | undefined) => {
  const value = String(rawValue || "").toLowerCase().trim();
  if (!value) return "pending" as const;
  if (["paid", "confirmed", "received", "receveid", "received_in_cash"].includes(value)) return "confirmed" as const;
  if (["failed", "overdue", "cancelled", "canceled", "declined"].includes(value)) return "failed" as const;
  if (["refunded", "refund_requested"].includes(value)) return "refunded" as const;
  return "pending" as const;
};

export function AsaasDepositModal({ open, onOpenChange, rental, onDepositComplete }: AsaasDepositModalProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCPF, setClientCPF] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const { contract } = useContractRealtime(rental?.id);
  const { inspections } = useInspectionRealtime(rental?.id);
  const { hasPaid: reservationPaid } = usePaymentRealtime(rental?.id);
  const {
    payment: depositPayment,
    paymentStatus: depositStatus,
    hasPaid: depositPaid,
    refetch,
  } = useDepositRealtime(rental?.id, Boolean(rental?.deposit_amount));

  useEffect(() => {
    if (!open || !rental) return;

    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("oli_profiles")
        .select("full_name, email, cpf, phone, whatsapp_phone")
        .eq("id", user.id)
        .maybeSingle();

      setClientName(profile?.full_name || "");
      setClientEmail(profile?.email || user.email || "");
      setClientCPF(profile?.cpf || "");
      setClientPhone(profile?.whatsapp_phone || profile?.phone || "");
    };

    void loadProfile();
  }, [open, rental]);

  useEffect(() => {
    if (depositPaid && open) {
      onDepositComplete?.();
    }
  }, [depositPaid, onDepositComplete, open]);

  const contractStage = deriveContractStage(contract);
  const ownerInitialDone = inspections.some(
    (inspection) =>
      inspection.inspection_stage === "owner_initial_inspection" &&
      (inspection.status === "validated" || inspection.status === "completed"),
  );
  const rentalLicenseApproved =
    ((rental as { driver_license_verification_status?: string | null } | null)?.driver_license_verification_status || "not_started") ===
    "approved";
  const contractSigned = contractStage === "both_signed" || contractStage === "inspection_released";
  const depositAmount = rental?.deposit_amount || 0;

  const requirements = useMemo(
    () => [
      { label: "Reserva aprovada pelo locador", done: rental?.status === "approved" || rental?.status === "active" },
      { label: "CNH da reserva validada", done: rentalLicenseApproved },
      { label: "Contrato assinado pelas partes", done: contractSigned },
      { label: "Vistoria inicial do locador concluida", done: ownerInitialDone },
      { label: "Pagamento principal da reserva confirmado", done: reservationPaid },
      { label: "Caucao configurada no anuncio", done: depositAmount > 0 },
    ],
    [contractSigned, depositAmount, ownerInitialDone, rental?.status, rentalLicenseApproved, reservationPaid],
  );

  const allRequirementsMet = requirements.every((item) => item.done);
  const primaryLink = depositPayment?.payment_link || depositPayment?.invoice_url || depositPayment?.bank_slip_url || null;

  const handleCopyPix = async () => {
    if (!depositPayment?.pix_copy_paste) return;

    try {
      await navigator.clipboard.writeText(depositPayment.pix_copy_paste);
      setCopied(true);
      toast.success("Codigo da caucao copiado.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar o codigo.");
    }
  };

  const handleGenerateDeposit = async () => {
    if (!rental || !allRequirementsMet) return;

    const cleanCPF = clientCPF.replace(/\D/g, "");
    const cleanPhone = clientPhone.replace(/\D/g, "");

    if (!clientName.trim()) {
      toast.error("Nome completo e obrigatório.");
      return;
    }
    if (!clientEmail.trim()) {
      toast.error("Email e obrigatório.");
      return;
    }
    if (cleanCPF.length < 11) {
      toast.error("CPF inválido.");
      return;
    }
    if (cleanPhone.length < 10) {
      toast.error("Celular inválido.");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário nao autenticado");

      const payload = {
        _webhook_target: "oli-caucao-asaas",
        event: "deposit_escrow_requested",
        provider: "asaas",
        payment_type: "deposit",
        rental_id: rental.id,
        user_id: user.id,
        vehicle_id: rental.vehicle_id,
        amount: depositAmount,
        due_date: depositPayment?.due_date || null,
        customer: {
          name: clientName.trim(),
          email: clientEmail.trim(),
          cpfCnpj: cleanCPF,
          phone: cleanPhone,
        },
        vehicle: {
          title:
            rental.vehicle?.title ||
            `${rental.vehicle?.brand || ""} ${rental.vehicle?.model || ""} ${rental.vehicle?.year || ""}`.trim(),
          plate: rental.vehicle?.plate || "",
        },
        escrow: {
          enabled: true,
          provider: "asaas",
          release_condition: "manual_after_owner_and_platform_approval",
          release_checklist: [
            "devolucao_do_veículo",
            "vistoria_final_aprovada",
            "aval_do_locador",
            "aval_da_plataforma_oli",
          ],
        },
      };

      const { data, error } = await supabase.functions.invoke("webhook-proxy", {
        body: payload,
      });

      if (error) throw error;

      const responseData = (data || {}) as Record<string, unknown>;
      const normalizedStatus = mapProviderStatus(String(responseData.status || "pending"));
      const paymentPayload = {
        rental_id: rental.id,
        user_id: user.id,
        payment_type: "deposit",
        amount: depositAmount,
        method: typeof responseData.method === "string" ? responseData.method : "asaas",
        billingType: typeof responseData.billingType === "string" ? responseData.billingType : "UNDEFINED",
        provider: "asaas",
        provider_payment_id:
          typeof responseData.provider_payment_id === "string"
            ? responseData.provider_payment_id
            : typeof responseData.id === "string"
              ? responseData.id
              : null,
        provider_customer_id:
          typeof responseData.provider_customer_id === "string"
            ? responseData.provider_customer_id
            : typeof responseData.customer === "string"
              ? responseData.customer
              : user.id,
        external_reference:
          typeof responseData.external_reference === "string"
            ? responseData.external_reference
            : typeof responseData.reference === "string"
              ? responseData.reference
              : null,
        payment_link:
          typeof responseData.payment_link === "string"
            ? responseData.payment_link
            : typeof responseData.checkout_url === "string"
              ? responseData.checkout_url
              : typeof responseData.url === "string"
                ? responseData.url
                : null,
        invoice_url:
          typeof responseData.invoice_url === "string"
            ? responseData.invoice_url
            : typeof responseData.invoiceUrl === "string"
              ? responseData.invoiceUrl
              : null,
        bank_slip_url:
          typeof responseData.bank_slip_url === "string"
            ? responseData.bank_slip_url
            : typeof responseData.bankSlipUrl === "string"
              ? responseData.bankSlipUrl
              : null,
        pix_copy_paste:
          typeof responseData.pix_copy_paste === "string"
            ? responseData.pix_copy_paste
            : typeof responseData.pixCopyPaste === "string"
              ? responseData.pixCopyPaste
              : null,
        pix_qr_code:
          typeof responseData.pix_qr_code === "string"
            ? responseData.pix_qr_code
            : typeof responseData.qr_code_base64 === "string"
              ? responseData.qr_code_base64
              : null,
        due_date:
          typeof responseData.due_date === "string"
            ? responseData.due_date
            : typeof responseData.dueDate === "string"
              ? responseData.dueDate
              : null,
        status: normalizedStatus,
        status_detail:
          typeof responseData.message === "string"
            ? responseData.message
            : typeof responseData.description === "string"
              ? responseData.description
              : "Cobranca de caucao enviada para a Asaas.",
        webhook_payload: responseData as Json,
      };

      if (depositPayment?.id) {
        await supabase.from("oli_payments").update(paymentPayload).eq("id", depositPayment.id);
      } else {
        await supabase.from("oli_payments").insert(paymentPayload);
      }

      await refetch();

      if (normalizedStatus === "confirmed") {
        toast.success("Caucao confirmada.");
        onDepositComplete?.();
      } else {
        toast.success("Fluxo de caucao Asaas iniciado.");
      }
    } catch (error) {
      console.error("Erro ao gerar caucao Asaas:", error);
      toast.error("Não foi possível iniciar a caucao via Asaas.");
    } finally {
      setLoading(false);
    }
  };

  if (!rental) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Caucao via Asaas
          </DialogTitle>
          <DialogDescription>
            Esta etapa e separada do pagamento da reserva. A caucao fica retida ate a devolucao do veículo e so pode
            ser liberada com aval do locador e da OLI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border bg-secondary/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor da caucao</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(depositAmount)}</p>
              </div>
              <Badge variant={depositPaid ? "default" : depositStatus === "pending" ? "secondary" : "outline"}>
                {depositPaid ? "Garantida" : depositStatus === "pending" ? "Aguardando pagamento" : "Nao iniciada"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              A liberacao da caucao depende de devolucao do veículo, vistoria final aprovada, aval do locador e aval da
              plataforma.
            </p>
          </div>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Conta Escrow / retencao controlada</AlertTitle>
            <AlertDescription>
              O front foi preparado para a caucao rodar via Asaas em fluxo separado. A cobranca fica vinculada a esta
              reserva e o pagamento principal continua independente.
            </AlertDescription>
          </Alert>

          <div className="rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold">Checklist antes da caucao</h3>
            {requirements.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.label}</span>
                <Badge variant={item.done ? "default" : "outline"}>{item.done ? "Ok" : "Pendente"}</Badge>
              </div>
            ))}
          </div>

          {depositPaid ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Caucao garantida</h3>
                <p className="text-sm text-muted-foreground">
                  A caucao desta reserva ja foi registrada. O fluxo pode seguir para a retirada do veículo.
                </p>
              </div>
            </div>
          ) : depositPayment ? (
            <div className="rounded-xl border p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Cobranca Asaas gerada</h3>
                  <p className="text-sm text-muted-foreground">
                    Use o link abaixo para concluir a caucao e manter o valor retido ate a liberacao final.
                  </p>
                </div>
                <Badge variant={depositStatus === "failed" ? "destructive" : "secondary"}>
                  {depositStatus === "failed" ? "Falhou" : "Em aberto"}
                </Badge>
              </div>

              {depositPayment.external_reference && (
                <p className="text-xs text-muted-foreground">Referencia: {depositPayment.external_reference}</p>
              )}
              {depositPayment.due_date && (
                <p className="text-xs text-muted-foreground">Vencimento: {depositPayment.due_date}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {primaryLink && (
                  <Button type="button" onClick={() => window.open(primaryLink, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir cobranca Asaas
                  </Button>
                )}
                {depositPayment.pix_copy_paste && (
                  <Button type="button" variant="outline" onClick={handleCopyPix}>
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? "Codigo copiado" : "Copiar codigo"}
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => void refetch()}>
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Atualizar status
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-4 space-y-4">
              <h3 className="font-semibold">Dados para gerar a caucao</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="depositName">Nome completo</Label>
                  <Input id="depositName" value={clientName} onChange={(event) => setClientName(event.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="depositEmail">Email</Label>
                  <Input
                    id="depositEmail"
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositCpf">CPF</Label>
                  <Input
                    id="depositCpf"
                    value={clientCPF}
                    placeholder="000.000.000-00"
                    onChange={(event) => setClientCPF(formatCPF(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositPhone">Celular</Label>
                  <Input
                    id="depositPhone"
                    value={clientPhone}
                    placeholder="(00) 00000-0000"
                    onChange={(event) => setClientPhone(formatPhone(event.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Fluxo planejado para a OLI:</p>
            <p>1. Pagamento principal confirmado.</p>
            <p>2. Caucao gerada e paga via Asaas.</p>
            <p>3. Valor fica retido ate a devolucao do veículo.</p>
            <p>4. Liberacao manual somente com aval do locador e da plataforma.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {!depositPayment && (
            <Button onClick={() => void handleGenerateDeposit()} disabled={!allRequirementsMet || loading || depositAmount <= 0}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
              Gerar caucao na Asaas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
