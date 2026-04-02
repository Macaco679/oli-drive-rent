import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CreditCard, 
  Loader2, 
  CheckCircle2,
  Lock,
  ArrowLeft,
  AlertCircle
} from "lucide-react";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CardPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  onPaymentComplete?: () => void;
  onBack?: () => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
};

const formatExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }
  return cleaned;
};

const formatCVV = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, 4);
};

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

export function CardPaymentModal({ 
  open, 
  onOpenChange, 
  rental, 
  onPaymentComplete,
  onBack
}: CardPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Client info
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCPF, setClientCPF] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState("1");

  // Load profile data when modal opens
  useEffect(() => {
    if (open) {
      loadProfile();
    }
  }, [open]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("oli_profiles")
      .select("full_name, email, cpf, phone, whatsapp_phone")
      .eq("id", user.id)
      .single();
    if (profile) {
      setClientName(profile.full_name || "");
      setClientEmail(profile.email || user.email || "");
      setClientCPF(profile.cpf || "");
      setClientPhone(profile.whatsapp_phone || profile.phone || "");
      setCardName(profile.full_name?.toUpperCase() || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rental) return;

    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    const cleanCPF = clientCPF.replace(/\D/g, "");
    const cleanPhone = clientPhone.replace(/\D/g, "");

    if (!clientName.trim()) { toast.error("Nome do cliente é obrigatório"); return; }
    if (!clientEmail.trim()) { toast.error("Email é obrigatório"); return; }
    if (cleanCPF.length < 11) { toast.error("CPF inválido"); return; }
    if (cleanPhone.length < 10) { toast.error("Celular inválido"); return; }
    if (cleanCardNumber.length < 16) { toast.error("Número do cartão inválido"); return; }
    if (!cardName.trim()) { toast.error("Nome do titular é obrigatório"); return; }
    if (expiry.length < 5) { toast.error("Data de validade inválida"); return; }
    if (cvv.length < 3) { toast.error("CVV inválido"); return; }

    setLoading(true);
    setErrorMsg(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const [expiryMonth, expiryYear] = expiry.split("/");
      const amount = rental.total_price || 0;
      const numInstallments = parseInt(installments);
      const installmentValue = amount / numInstallments;

      const { data, error } = await supabase.functions.invoke("webhook-proxy", {
        body: {
          _webhook_target: "oli-pagamento-cartao",
          cliente: {
            nome: clientName,
            email: clientEmail,
            cpf: cleanCPF,
            celular: cleanPhone,
          },
          total: amount,
          billingType: "CREDIT_CARD",
          valor_parcela: installmentValue,
          cartao: {
            holderName: cardName,
            number: cleanCardNumber,
            expiryMonth: expiryMonth,
            expiryYear: `20${expiryYear}`,
            cvv: cvv,
          },
          veículo: {
            placa: rental.vehicle?.plate || "",
          },
          parcelas: numInstallments,
          valor_parcela_formatado: formatCurrency(installmentValue),
          creditCard: true,
          rental_id: rental.id,
          user_id: user.id,
        },
      });

      if (error) throw error;
      console.log("Card webhook response:", data);

      // Unwrap array response from n8n
      const raw = Array.isArray(data) ? data[0] : data;
      // Extract payment info from nested structure
      const paymentInfo = raw?.ui?.payment || raw?.payment || raw;

      const isApproved = paymentInfo?.approved === true 
        || paymentInfo?.status === "CONFIRMED" 
        || paymentInfo?.status === "paid"
        || raw?.ok === true;
      const isDeclined = paymentInfo?.status === "DECLINED" 
        || paymentInfo?.status === "failed" 
        || paymentInfo?.approved === false;

      if (isApproved) {
        // Insert payment record into oli_payments so realtime picks it up
        const { error: insertErr } = await supabase
          .from("oli_payments")
          .insert({
            rental_id: rental.id,
            user_id: user.id,
            payment_type: "rental",
            amount: amount,
            method: "credit_card",
            status: "confirmed",
            provider: paymentInfo?.provider || "asaas",
            provider_payment_id: paymentInfo?.id || null,
            provider_customer_id: paymentInfo?.provider_customer_id || "",
            external_reference: paymentInfo?.id || null,
            billingType: "CREDIT_CARD",
          });

        if (insertErr) {
          console.warn("Payment record insert (may already exist):", insertErr);
        }

        // Update rental status to active
        await supabase
          .from("oli_rentals")
          .update({ status: "active" })
          .eq("id", rental.id);

        setSuccess(true);
        toast.success("Pagamento aprovado!");
        onPaymentComplete?.();
      } else if (isDeclined) {
        const msg = paymentInfo?.message || raw?.message || "Pagamento recusado. Verifique os dados do cartão.";
        setErrorMsg(msg);
        toast.error(msg);
      } else {
        setSuccess(true);
        toast.success("Pagamento processado!");
        onPaymentComplete?.();
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
      setErrorMsg("Erro ao processar pagamento. Tente novamente.");
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

  const amount = rental.total_price || 0;

  const installmentOptions = [];
  for (let i = 1; i <= 12; i++) {
    const installmentValue = amount / i;
    installmentOptions.push({
      value: i.toString(),
      label: i === 1 
        ? `À vista - ${formatCurrency(amount)}`
        : `${i}x de ${formatCurrency(installmentValue)} sem juros`
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && !success && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamento com Cartão
            </DialogTitle>
          </div>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary">Pagamento Aprovado!</h3>
              <p className="text-muted-foreground mt-2">
                Seu pagamento foi processado com sucesso.
              </p>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              {formatCurrency(amount)}
            </Badge>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount display */}
            <div className="text-center bg-secondary/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Total a pagar</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Separator />

            {/* Client Info Section */}
            <p className="text-sm font-medium text-muted-foreground">Dados do Cliente</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="clientName">Nome Completo</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientCPF">CPF</Label>
                <Input
                  id="clientCPF"
                  placeholder="000.000.000-00"
                  value={clientCPF}
                  onChange={(e) => setClientCPF(formatCPF(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Celular</Label>
                <Input
                  id="clientPhone"
                  placeholder="(00) 00000-0000"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <Separator />

            {/* Card Info Section */}
            <p className="text-sm font-medium text-muted-foreground">Dados do Cartão</p>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Número do Cartão</Label>
              <Input
                id="cardNumber"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardName">Nome do Titular</Label>
              <Input
                id="cardName"
                placeholder="Como está no cartão"
                value={cardName}
                onChange={(e) => setCardName(e.target.value.toUpperCase())}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Validade</Label>
                <Input
                  id="expiry"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="•••"
                  value={cvv}
                  onChange={(e) => setCvv(formatCVV(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="installments">Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {installmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Security notice */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>Seus dados estão protegidos com criptografia de ponta a ponta</span>
            </div>
          </form>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          {success ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>Pagar {formatCurrency(amount)}</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
