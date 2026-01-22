import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/supabase";
import { generatePaymentReceiptPDF } from "@/lib/pdfReceiptService";
import { ArrowLeft, Receipt, Download, Calendar as CalendarIcon, Car, CheckCircle, Clock, XCircle, CreditCard, Filter, X } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  const [filteredPayments, setFilteredPayments] = useState<PaymentWithRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const navigate = useNavigate();

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [payments, statusFilter, startDate, endDate]);

  const loadPayments = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

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

  const applyFilters = () => {
    let result = [...payments];

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Filter by date range
    if (startDate || endDate) {
      result = result.filter((p) => {
        const paymentDate = new Date(p.created_at);
        
        if (startDate && endDate) {
          return isWithinInterval(paymentDate, {
            start: startOfDay(startDate),
            end: endOfDay(endDate),
          });
        } else if (startDate) {
          return paymentDate >= startOfDay(startDate);
        } else if (endDate) {
          return paymentDate <= endOfDay(endDate);
        }
        return true;
      });
    }

    setFilteredPayments(result);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters = statusFilter !== "all" || startDate || endDate;

  const getVehicleTitle = (payment: PaymentWithRental) => {
    if (!payment.rental?.vehicle) return "Veículo";
    const v = payment.rental.vehicle;
    return v.title || `${v.brand || ""} ${v.model || ""} ${v.year || ""}`.trim();
  };

  const handleDownloadPDF = async (payment: PaymentWithRental) => {
    setGeneratingPDF(payment.id);
    try {
      const vehicleTitle = getVehicleTitle(payment);
      const paymentType = paymentTypeLabels[payment.payment_type] || payment.payment_type;

      await generatePaymentReceiptPDF({
        id: payment.id,
        amount: payment.amount,
        paymentType,
        vehicleTitle,
        status: payment.status,
        createdAt: payment.created_at,
        externalReference: payment.external_reference,
        rentalPeriod: payment.rental ? {
          startDate: payment.rental.start_date,
          endDate: payment.rental.end_date,
        } : undefined,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    }
    setGeneratingPDF(null);
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

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Filtros</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4">
            {/* Status Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="completed">Pago</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm text-muted-foreground mb-1 block">Data inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm text-muted-foreground mb-1 block">Data final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-muted-foreground">
            {filteredPayments.length} de {payments.length} pagamento{payments.length !== 1 ? "s" : ""}
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <CreditCard className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {payments.length === 0 ? "Nenhum pagamento ainda" : "Nenhum resultado encontrado"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {payments.length === 0 
                ? "Quando você fizer pagamentos, eles aparecerão aqui."
                : "Tente ajustar os filtros para encontrar o que procura."}
            </p>
            {payments.length === 0 ? (
              <Button onClick={() => navigate("/search")}>Buscar veículos</Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPayments.map((payment) => {
              const status = statusConfig[payment.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const vehicleTitle = getVehicleTitle(payment);
              const paymentType = paymentTypeLabels[payment.payment_type] || payment.payment_type;
              const isGenerating = generatingPDF === payment.id;

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
                          <CalendarIcon className="w-4 h-4" />
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
                          onClick={() => handleDownloadPDF(payment)}
                          disabled={isGenerating}
                          className="flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {isGenerating ? "Gerando..." : "PDF"}
                          </span>
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
