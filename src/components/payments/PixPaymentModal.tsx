import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Copy, 
  Check, 
  Loader2, 
  Timer, 
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { 
  PixPaymentData, 
  createPixPayment, 
  copyPixCode,
  simulatePixPaymentConfirmation,
  getPixPaymentByRentalId
} from "@/lib/pixPaymentService";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { toast } from "sonner";

interface PixPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  onPaymentComplete?: () => void;
}

export function PixPaymentModal({ open, onOpenChange, rental, onPaymentComplete }: PixPaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PixPaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open && rental) {
      initializePayment();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [open, rental]);

  useEffect(() => {
    if (payment && payment.status === "pending") {
      // Start countdown timer
      timerRef.current = setInterval(() => {
        const expires = new Date(payment.expires_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [payment]);

  const initializePayment = async () => {
    if (!rental) return;
    setLoading(true);

    try {
      // Check for existing pending payment
      const existing = getPixPaymentByRentalId(rental.id);
      if (existing && existing.status === "pending") {
        setPayment(existing);
      } else {
        // Create new payment
        const newPayment = await createPixPayment(rental);
        setPayment(newPayment);
      }
    } catch (error) {
      console.error("Error creating PIX payment:", error);
      toast.error("Erro ao gerar pagamento PIX");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!payment) return;
    
    const success = await copyPixCode(payment.pix_code);
    if (success) {
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error("Erro ao copiar código");
    }
  };

  const handleSimulatePayment = async () => {
    if (!payment) return;
    
    setConfirming(true);
    try {
      const success = await simulatePixPaymentConfirmation(payment.id);
      if (success) {
        setPayment({ ...payment, status: "paid", paid_at: new Date().toISOString() });
        toast.success("Pagamento confirmado!");
        onPaymentComplete?.();
      } else {
        toast.error("Erro ao confirmar pagamento");
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Erro ao confirmar pagamento");
    } finally {
      setConfirming(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (!rental) return null;

  const isPaid = payment?.status === "paid";
  const isExpired = timeLeft === 0 && payment?.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Pagamento via PIX
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isPaid ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary">Pagamento Confirmado!</h3>
              <p className="text-muted-foreground mt-2">
                Seu pagamento foi processado com sucesso.
              </p>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              {formatCurrency(payment?.amount || 0)}
            </Badge>
          </div>
        ) : isExpired ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-destructive">PIX Expirado</h3>
              <p className="text-muted-foreground mt-2">
                O código PIX expirou. Gere um novo código para continuar.
              </p>
            </div>
            <Button onClick={initializePayment} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Gerar Novo Código
            </Button>
          </div>
        ) : payment ? (
          <div className="space-y-6">
            {/* Amount */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm">Valor a pagar</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(payment.amount)}</p>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span className="text-sm">Expira em: </span>
              <Badge variant="outline" className="font-mono">
                {formatTime(timeLeft)}
              </Badge>
            </div>

            <Separator />

            {/* QR Code */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl shadow-inner">
                <img 
                  src={payment.qr_code_base64} 
                  alt="QR Code PIX" 
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Escaneie o QR Code com o app do seu banco
              </p>
            </div>

            <Separator />

            {/* PIX Copy/Paste */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-secondary rounded-lg p-3 font-mono text-xs break-all max-h-20 overflow-y-auto">
                  {payment.pix_code}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleCopyCode}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Simulation button (dev only) */}
            <div className="pt-2 border-t border-dashed border-border">
              <p className="text-xs text-muted-foreground text-center mb-2">
                🧪 Modo de desenvolvimento
              </p>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={handleSimulatePayment}
                disabled={confirming}
              >
                {confirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Simular Pagamento Recebido
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Erro ao gerar pagamento. Tente novamente.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isPaid ? "Fechar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
