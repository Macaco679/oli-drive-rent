import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  Lock,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
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

const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
};

const formatExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 2) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return cleaned;
};

const formatCVV = (value: string): string => value.replace(/\D/g, "").slice(0, 4);

export function AsaasDepositModal({ open, onOpenChange, rental, onDepositComplete }: AsaasDepositModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Client info
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCPF, setClientCPF] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState("1");

  const { contract } = useContractRealtime(rental?.id);
  const { inspections } = useInspectionRealtime(rental?.id);
  const { hasPaid: reservationPaid } = usePaymentRealtime(rental?.id);
  const { hasPaid: depositPaid } = useDepositRealtime(rental?.id, Boolean(rental?.deposit_amount));

  useEffect(() => {
    if (!open || !rental) return;
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
      setCardName(profile?.full_name?.toUpperCase() || "");
    };
    void loadProfile();
  }, [open, rental]);

  useEffect(() => {
    if (depositPaid && open) {
      setSuccess(true);
      onDepositComplete?.();
    }
  }, [depositPaid, onDepositComplete, open]);

  const contractStage = deriveContractStage(contract);
  const ownerInitialDone = inspections.some(
    (i) => i.inspection_stage === "owner_initial_inspection" && (i.status === "validated" || i.status === "completed"),
  );
  const rentalLicenseApproved =
    ((rental as { driver_license_verification_status?: string | null } | null)?.driver_license_verification_status || "not_started") === "approved";
  const contractSigned = contractStage === "both_signed" || contractStage === "inspection_released";
  const depositAmount = rental?.deposit_amount || 0;

  const requirements = useMemo(
    () => [
      { label: "Reserva aprovada pelo locador", done: rental?.status === "approved" || rental?.status === "active" },
      { label: "CNH da reserva validada", done: rentalLicenseApproved },
      { label: "Contrato assinado pelas partes", done: contractSigned },
      { label: "Vistoria inicial do locador concluida", done: ownerInitialDone },
      { label: "Pagamento principal da reserva confirmado", done: reservationPaid },
      { label: "Caução configurada no anúncio", done: depositAmount > 0 },
    ],
    [contractSigned, depositAmount, ownerInitialDone, rental?.status, rentalLicenseApproved, reservationPaid],
  );

  const allRequirementsMet = requirements.every((item) => item.done);

  const installmentOptions = useMemo(() => {
    const opts = [];
    for (let i = 1; i <= 12; i++) {
      const val = depositAmount / i;
      opts.push({
        value: i.toString(),
        label: i === 1 ? `À vista - ${formatCurrency(depositAmount)}` : `${i}x de ${formatCurrency(val)} sem juros`,
      });
    }
    return opts;
  }, [depositAmount]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!rental || !allRequirementsMet) return;

    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    const cleanCPF = clientCPF.replace(/\D/g, "");
    const cleanPhone = clientPhone.replace(/\D/g, "");

    if (!clientName.trim()) { toast.error("Nome completo é obrigatório."); return; }
    if (!clientEmail.trim()) { toast.error("Email é obrigatório."); return; }
    if (cleanCPF.length < 11) { toast.error("CPF inválido."); return; }
    if (cleanPhone.length < 10) { toast.error("Celular inválido."); return; }
    if (cleanCardNumber.length < 16) { toast.error("Número do cartão inválido."); return; }
    if (!cardName.trim()) { toast.error("Nome do titular é obrigatório."); return; }
    if (expiry.length < 5) { toast.error("Data de validade inválida."); return; }
    if (cvv.length < 3) { toast.error("CVV inválido."); return; }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const [expiryMonth, expiryYear] = expiry.split("/");
      const numInstallments = parseInt(installments);
      const installmentValue = depositAmount / numInstallments;

      const { data, error } = await supabase.functions.invoke("webhook-proxy", {
        body: {
          _webhook_target: "oli-pagamento-cartao",
          cliente: {
            nome: clientName,
            email: clientEmail,
            cpf: cleanCPF,
            celular: cleanPhone,
          },
          total: depositAmount,
          billingType: "CREDIT_CARD",
          valor_parcela: installmentValue,
          cartao: {
            holderName: cardName,
            number: cleanCardNumber,
            expiryMonth,
            expiryYear: `20${expiryYear}`,
            cvv,
          },
          veículo: {
            placa: rental.vehicle?.plate || "",
          },
          parcelas: numInstallments,
          valor_parcela_formatado: formatCurrency(installmentValue),
          creditCard: true,
          rental_id: rental.id,
          user_id: user.id,
          vehicle_id: rental.vehicle_id,
          payment_type: "deposit",
        },
      });

      if (error) throw error;
      console.log("Deposit card webhook response:", data);

      const raw = Array.isArray(data) ? data[0] : data;
      const paymentInfo = raw?.ui?.payment || raw?.payment || raw;

      const isApproved =
        paymentInfo?.approved === true ||
        paymentInfo?.status === "CONFIRMED" ||
        paymentInfo?.status === "paid" ||
        raw?.ok === true;
      const isDeclined =
        paymentInfo?.status === "DECLINED" ||
        paymentInfo?.status === "failed" ||
        paymentInfo?.approved === false;

      if (isApproved) {
        await supabase.from("oli_payments").insert({
          rental_id: rental.id,
          user_id: user.id,
          payment_type: "deposit",
          amount: depositAmount,
          method: "credit_card",
          status: "confirmed",
          provider: paymentInfo?.provider || "asaas",
          provider_payment_id: paymentInfo?.id || null,
          provider_customer_id: paymentInfo?.provider_customer_id || user.id,
          external_reference: paymentInfo?.id || null,
          billingType: "CREDIT_CARD",
        });

        setSuccess(true);
        toast.success("Caução aprovada!");
        onDepositComplete?.();
      } else if (isDeclined) {
        const msg = paymentInfo?.message || raw?.message || "Pagamento recusado. Verifique os dados do cartão.";
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        setSuccess(true);
        toast.success("Caução processada!");
        onDepositComplete?.();
      }
    } catch (err) {
      console.error("Erro ao processar caução:", err);
      toast.error("Não foi possível processar a caução. Tente novamente.");
      setErrorMsg("Erro ao processar a caução. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setErrorMsg(null);
    setCardNumber("");
    setCardName("");
    setExpiry("");
    setCvv("");
    setInstallments("1");
    onOpenChange(false);
  };

  if (!rental) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pagamento da Caução
          </DialogTitle>
          <DialogDescription>
            A caução fica retida até a devolução do veículo e só pode ser liberada com aval do locador e da OLI.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary">Caução Aprovada!</h3>
              <p className="text-muted-foreground mt-2">
                A caução desta reserva foi registrada. O fluxo pode seguir para a retirada do veículo.
              </p>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              {formatCurrency(depositAmount)}
            </Badge>
          </div>
        ) : depositPaid ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Caução garantida</h3>
              <p className="text-sm text-muted-foreground">
                A caução desta reserva já foi registrada. O fluxo pode seguir para a retirada do veículo.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Amount */}
            <div className="text-center bg-secondary/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Valor da caução</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(depositAmount)}</p>
            </div>

            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Retenção controlada</AlertTitle>
              <AlertDescription>
                O valor da caução fica vinculado a esta reserva. A liberação depende de devolução do veículo, vistoria final aprovada, aval do locador e da plataforma.
              </AlertDescription>
            </Alert>

            {/* Checklist */}
            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Checklist antes da caução</h3>
              {requirements.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.label}</span>
                  <Badge variant={item.done ? "default" : "outline"}>{item.done ? "Ok" : "Pendente"}</Badge>
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {allRequirementsMet && (
              <>
                <Separator />

                {/* Client Info */}
                <p className="text-sm font-medium text-muted-foreground">Dados do Cliente</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="depositClientName">Nome Completo</Label>
                    <Input id="depositClientName" value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={loading} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="depositClientEmail">Email</Label>
                    <Input id="depositClientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositClientCpf">CPF</Label>
                    <Input id="depositClientCpf" placeholder="000.000.000-00" value={clientCPF} onChange={(e) => setClientCPF(formatCPF(e.target.value))} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositClientPhone">Celular</Label>
                    <Input id="depositClientPhone" placeholder="(00) 00000-0000" value={clientPhone} onChange={(e) => setClientPhone(formatPhone(e.target.value))} disabled={loading} />
                  </div>
                </div>

                <Separator />

                {/* Card Info */}
                <p className="text-sm font-medium text-muted-foreground">Dados do Cartão</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="depositCardNumber">Número do Cartão</Label>
                    <Input id="depositCardNumber" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositCardName">Nome do Titular</Label>
                    <Input id="depositCardName" placeholder="Como está no cartão" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} disabled={loading} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="depositExpiry">Validade</Label>
                      <Input id="depositExpiry" placeholder="MM/AA" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="depositCvv">CVV</Label>
                      <Input id="depositCvv" type="password" placeholder="•••" value={cvv} onChange={(e) => setCvv(formatCVV(e.target.value))} disabled={loading} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositInstallments">Parcelas</Label>
                    <Select value={installments} onValueChange={setInstallments} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {installmentOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <span>Seus dados estão protegidos com criptografia de ponta a ponta</span>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {success ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : depositPaid ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              {allRequirementsMet && (
                <Button onClick={() => void handleSubmit()} disabled={loading || depositAmount <= 0}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>Pagar {formatCurrency(depositAmount)}</>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
