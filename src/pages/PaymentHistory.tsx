import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/supabase";
import { ArrowLeft, Receipt, Download, Calendar, Car, CheckCircle, Clock, XCircle, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Payment {
  id: string;
  rental_id: string;
  amount: number;
  payment_type: string;
  method: string | null;
  status: string;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentWithRental extends Payment {
  rental?: {
    id: string;
    start_date: string;
    end_date: string;
    vehicle?: {
      title: string | null;
      brand: string | null;
      model: string | null;
      year: number | null;
    };
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  completed: { label: "Pago", variant: "default", icon: CheckCircle },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  refunded: { label: "Reembolsado", variant: "outline", icon: Receipt },
};

const paymentTypeLabels: Record<string, string> = {
  rental: "Aluguel",
  deposit: "Caução",
  fine: "Multa",
  damage: "Danos",
};

export default function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentWithRental[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Buscar pagamentos do usuário
    const { data: paymentsData, error } = await supabase
      .from("oli_payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar pagamentos:", error);
      setLoading(false);
      return;
    }

    // Para cada pagamento, buscar dados da reserva e veículo
    const paymentsWithDetails: PaymentWithRental[] = await Promise.all(
      (paymentsData || []).map(async (payment) => {
        const { data: rental } = await supabase
          .from("oli_rentals")
          .select("id, start_date, end_date, vehicle_id")
          .eq("id", payment.rental_id)
          .single();

        let vehicle = null;
        if (rental?.vehicle_id) {
          const { data: vehicleData } = await supabase
            .from("oli_vehicles")
            .select("title, brand, model, year")
            .eq("id", rental.vehicle_id)
            .single();
          vehicle = vehicleData;
        }

        return {
          ...payment,
          rental: rental ? { ...rental, vehicle: vehicle || undefined } : undefined,
        } as PaymentWithRental;
      })
    );

    setPayments(paymentsWithDetails);
    setLoading(false);
  };

  const getVehicleTitle = (payment: PaymentWithRental) => {
    if (!payment.rental?.vehicle) return "Veículo";
    const v = payment.rental.vehicle;
    return v.title || `${v.brand || ""} ${v.model || ""} ${v.year || ""}`.trim();
  };

  const handleDownloadReceipt = (payment: PaymentWithRental) => {
    // Gerar comprovante em texto
    const vehicleTitle = getVehicleTitle(payment);
    const status = statusConfig[payment.status] || statusConfig.pending;
    const paymentType = paymentTypeLabels[payment.payment_type] || payment.payment_type;

    const receiptContent = `
═══════════════════════════════════════════════════════════════
                    COMPROVANTE DE PAGAMENTO
                         Oli Drive
═══════════════════════════════════════════════════════════════

Data: ${format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
Código: ${payment.id.slice(0, 8).toUpperCase()}

───────────────────────────────────────────────────────────────
DETALHES DO PAGAMENTO
───────────────────────────────────────────────────────────────

Tipo: ${paymentType}
Veículo: ${vehicleTitle}
${payment.rental ? `Período: ${format(new Date(payment.rental.start_date), "dd/MM/yyyy")} a ${format(new Date(payment.rental.end_date), "dd/MM/yyyy")}` : ""}

Método: PIX
Status: ${status.label}
${payment.external_reference ? `Referência: ${payment.external_reference}` : ""}

───────────────────────────────────────────────────────────────
                                          VALOR: R$ ${payment.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
───────────────────────────────────────────────────────────────

Este é um comprovante digital gerado pela plataforma Oli Drive.
Para dúvidas, entre em contato pelo suporte.

═══════════════════════════════════════════════════════════════
    `.trim();

    // Criar blob e fazer download
    const blob = new Blob([receiptContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-oli-${payment.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar ao perfil</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Histórico de Pagamentos</h1>
            <p className="text-muted-foreground">Seus pagamentos e comprovantes PIX</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <CreditCard className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum pagamento ainda</h2>
            <p className="text-muted-foreground mb-6">
              Quando você fizer pagamentos, eles aparecerão aqui.
            </p>
            <Button onClick={() => navigate("/search")}>
              Buscar veículos
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const status = statusConfig[payment.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const vehicleTitle = getVehicleTitle(payment);
              const paymentType = paymentTypeLabels[payment.payment_type] || payment.payment_type;

              return (
                <div
                  key={payment.id}
                  className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icon */}
                    <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                      <Car className="w-7 h-7 text-primary" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-lg truncate">{vehicleTitle}</h3>
                        <Badge variant={status.variant} className="flex-shrink-0">
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Receipt className="w-4 h-4" />
                          {paymentType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(payment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {payment.rental && (
                          <span>
                            Período: {format(new Date(payment.rental.start_date), "dd/MM")} - {format(new Date(payment.rental.end_date), "dd/MM")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <span className="text-xl font-bold text-primary">
                        R$ {payment.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      {payment.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReceipt(payment)}
                          className="flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Comprovante</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Reference Code */}
                  {payment.external_reference && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <span className="text-sm text-muted-foreground">
                        Código de referência: <code className="bg-secondary px-2 py-1 rounded text-xs">{payment.external_reference}</code>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WebLayout>
  );
}
