import { useState, useEffect, useRef } from "react";
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
  QrCode, 
  Copy, 
  Check, 
  Loader2, 
  Timer, 
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft
} from "lucide-react";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PixPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  onPaymentComplete?: () => void;
  onBack?: () => void;
}

interface PixWebhookResponse {
  success?: boolean;
  pix_code?: string;
  pix_copy_paste?: string;
  qr_code_base64?: string;
  qr_code?: string;
  payment_id?: string;
  provider_payment_id?: string;
  expires_at?: string;
  status?: string;
  amount?: number;
  error?: string;
  [key: string]: unknown;
}

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

const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

/** Recursively search nested response for known PIX fields */
const PIX_KEYS = ["encodedImage", "qr_code_base64", "qr_code", "pix_copy_paste", "pixCopiaECola", "payload", "expires_at", "dueDate"] as const;

function flattenPixResponse(obj: unknown, depth = 0): Record<string, string> {
  const result: Record<string, string> = {};
  if (!obj || typeof obj !== "object" || depth > 5) return result;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (PIX_KEYS.includes(key as any) && typeof val === "string" && val.length > 0) {
      if (!result[key]) result[key] = val;
    }
    if (typeof val === "object" && val !== null) {
      const nested = flattenPixResponse(val, depth + 1);
      for (const [nk, nv] of Object.entries(nested)) {
        if (!result[nk]) result[nk] = nv;
      }
    }
  }
  return result;
}

export function PixPaymentModal({ open, onOpenChange, rental, onPaymentComplete, onBack }: PixPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"form" | "pending" | "paid" | "expired" | "error">("form");
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [webhookResponse, setWebhookResponse] = useState<PixWebhookResponse | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Client info
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCPF, setClientCPF] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    if (open) {
      loadProfile();
      setPaymentStatus("form");
      setPixCode(null);
      setQrCodeBase64(null);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (expiresAt && paymentStatus === "pending") {
      timerRef.current = setInterval(() => {
        const expires = new Date(expiresAt).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPaymentStatus("expired");
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt, paymentStatus]);

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
    }
  };

  const handleGeneratePix = async () => {
    if (!rental) return;

    const cleanCPF = clientCPF.replace(/\D/g, "");
    const cleanPhone = clientPhone.replace(/\D/g, "");

    if (!clientName.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!clientEmail.trim()) { toast.error("Email é obrigatório"); return; }
    if (cleanCPF.length < 11) { toast.error("CPF inválido"); return; }
    if (cleanPhone.length < 10) { toast.error("Celular inválido"); return; }

    setLoading(true);
    setPaymentStatus("pending");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        setPaymentStatus("error");
        setLoading(false);
        return;
      }

      const amount = rental.total_price || 0;

      const { data, error } = await supabase.functions.invoke("webhook-proxy", {
        body: {
          _webhook_target: "oli-pagamento-pix",
          cliente: {
            nome: clientName,
            email: clientEmail,
            cpf: cleanCPF,
            celular: cleanPhone,
          },
          total: amount,
          billingType: "PIX",
          veículo: {
            placa: rental.vehicle?.plate || "",
          },
          rental_id: rental.id,
          user_id: user.id,
          vehicle_id: rental.vehicle_id,
          payment_method: "pix",
        },
      });

      if (error) throw error;

      console.log("PIX webhook response:", JSON.stringify(data, null, 2));
      setWebhookResponse(data);

      // Deep-extract PIX fields from nested response (n8n may nest under ui.payment, payment, etc.)
      const flat = flattenPixResponse(data);
      const code = flat.pix_copy_paste || flat.payload || flat.pixCopiaECola || null;
      const qr = flat.encodedImage || flat.qr_code_base64 || flat.qr_code || null;
      const expiry = flat.expires_at || flat.dueDate || new Date(Date.now() + 30 * 60 * 1000).toISOString();

      setPixCode(code);
      setQrCodeBase64(qr);
      setExpiresAt(expiry);

      if (data?.status === "paid" || data?.status === "CONFIRMED" || data?.status === "RECEIVED") {
        setPaymentStatus("paid");
        onPaymentComplete?.();
      }
    } catch (error) {
      console.error("Error creating PIX payment:", error);
      toast.error("Erro ao gerar pagamento PIX");
      setPaymentStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar código");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!rental) return null;

  const isPaid = paymentStatus === "paid";
  const isExpired = paymentStatus === "expired";
  const isError = paymentStatus === "error";
  const isForm = paymentStatus === "form";
  const amount = rental.total_price || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {onBack && !isPaid && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Pagamento via PIX
            </DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando cobrança PIX...</p>
          </div>
        ) : isPaid ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-primary">Pagamento Confirmado!</h3>
              <p className="text-muted-foreground mt-2">Seu pagamento foi processado com sucesso.</p>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">{formatCurrency(amount)}</Badge>
          </div>
        ) : isExpired ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-destructive">PIX Expirado</h3>
              <p className="text-muted-foreground mt-2">O código PIX expirou. Gere um novo código para continuar.</p>
            </div>
            <Button onClick={() => setPaymentStatus("form")} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Gerar Novo Código
            </Button>
          </div>
        ) : isError ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-destructive">Erro ao gerar PIX</h3>
              <p className="text-muted-foreground mt-2">Não foi possível gerar a cobrança. Tente novamente.</p>
            </div>
            <Button onClick={() => setPaymentStatus("form")} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </Button>
          </div>
        ) : isForm ? (
          <div className="space-y-4">
            {/* Amount display */}
            <div className="text-center bg-secondary/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Valor a pagar</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
            </div>

            <Separator />

            <p className="text-sm font-medium text-muted-foreground">Dados do Cliente</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="pixClientName">Nome Completo</Label>
                <Input id="pixClientName" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="pixClientEmail">Email</Label>
                <Input id="pixClientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixClientCPF">CPF</Label>
                <Input id="pixClientCPF" placeholder="000.000.000-00" value={clientCPF} onChange={(e) => setClientCPF(formatCPF(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixClientPhone">Celular</Label>
                <Input id="pixClientPhone" placeholder="(00) 00000-0000" value={clientPhone} onChange={(e) => setClientPhone(formatPhone(e.target.value))} />
              </div>
            </div>

            <Button onClick={handleGeneratePix} className="w-full">
              Gerar PIX
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Amount */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm">Valor a pagar</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
            </div>

            {/* Timer */}
            {expiresAt && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Timer className="w-4 h-4" />
                <span className="text-sm">Expira em: </span>
                <Badge variant="outline" className="font-mono">{formatTime(timeLeft)}</Badge>
              </div>
            )}

            <Separator />

            {/* QR Code */}
            {qrCodeBase64 && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl shadow-inner">
                  <img 
                    src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`} 
                    alt="QR Code PIX" 
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">Escaneie o QR Code com o app do seu banco</p>
              </div>
            )}

            {qrCodeBase64 && pixCode && <Separator />}

            {/* PIX Copy/Paste */}
            {pixCode && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Ou copie o código PIX:</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-secondary rounded-lg p-3 font-mono text-xs break-all max-h-20 overflow-y-auto">
                    {pixCode}
                  </div>
                  <Button variant="outline" size="icon" onClick={handleCopyCode} className="flex-shrink-0">
                    {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Show raw response if no QR/code was extracted */}
            {!qrCodeBase64 && !pixCode && webhookResponse && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Resposta do servidor:</p>
                <div className="bg-secondary rounded-lg p-3 font-mono text-xs break-all max-h-40 overflow-y-auto">
                  {JSON.stringify(webhookResponse, null, 2)}
                </div>
              </div>
            )}
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
