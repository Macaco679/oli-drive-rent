import { useState } from "react";
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
  ArrowLeft
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

// Format card number with spaces
const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
};

// Format expiry date
const formatExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  }
  return cleaned;
};

// Format CVV
const formatCVV = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, 4);
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
  
  // Form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState("1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rental) return;

    // Basic validation
    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    if (cleanCardNumber.length < 16) {
      toast.error("Número do cartão inválido");
      return;
    }
    if (!cardName.trim()) {
      toast.error("Nome do titular é obrigatório");
      return;
    }
    if (expiry.length < 5) {
      toast.error("Data de validade inválida");
      return;
    }
    if (cvv.length < 3) {
      toast.error("CVV inválido");
      return;
    }

    setLoading(true);
    
    try {
      // Simulate payment processing (in production, integrate with payment gateway)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create payment record in database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error: paymentError } = await supabase
        .from("oli_payments")
        .insert({
          rental_id: rental.id,
          user_id: user.id,
          payment_type: "rental",
          amount: rental.total_price,
          method: "credit_card",
          status: "paid",
          external_reference: `card_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        });

      if (paymentError) throw paymentError;

      // Update rental status to active
      const { error: rentalError } = await supabase
        .from("oli_rentals")
        .update({ status: "active" })
        .eq("id", rental.id);

      if (rentalError) throw rentalError;

      setSuccess(true);
      toast.success("Pagamento aprovado!");
      onPaymentComplete?.();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setCardNumber("");
    setCardName("");
    setExpiry("");
    setCvv("");
    setInstallments("1");
    onOpenChange(false);
  };

  if (!rental) return null;

  const amount = rental.total_price || 0;

  // Generate installment options
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
      <DialogContent className="max-w-md">
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

            <Separator />

            {/* Card Number */}
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

            {/* Card Holder Name */}
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

            {/* Expiry and CVV */}
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

            {/* Installments */}
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

            {/* Dev mode notice */}
            <div className="pt-2 border-t border-dashed border-border">
              <p className="text-xs text-muted-foreground text-center">
                🧪 Modo de desenvolvimento - O pagamento será simulado
              </p>
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
