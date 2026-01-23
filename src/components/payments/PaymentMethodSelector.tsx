import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode, CreditCard, Check } from "lucide-react";
import { OliRental, OliVehicle } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type PaymentMethod = "pix" | "card";

interface PaymentMethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  onSelectMethod: (method: PaymentMethod) => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export function PaymentMethodSelector({ 
  open, 
  onOpenChange, 
  rental,
  onSelectMethod 
}: PaymentMethodSelectorProps) {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);

  const handleContinue = () => {
    if (selected) {
      onSelectMethod(selected);
    }
  };

  if (!rental) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escolha a forma de pagamento</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Amount display */}
          <div className="text-center bg-secondary/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total a pagar</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(rental.total_price || 0)}
            </p>
          </div>

          {/* Payment method options */}
          <div className="grid gap-3">
            <Card
              className={cn(
                "p-4 cursor-pointer transition-all border-2",
                selected === "pix" 
                  ? "border-primary bg-primary/5" 
                  : "border-transparent hover:border-muted-foreground/30"
              )}
              onClick={() => setSelected("pix")}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  selected === "pix" ? "bg-primary text-primary-foreground" : "bg-secondary"
                )}>
                  <QrCode className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">PIX</h3>
                  <p className="text-sm text-muted-foreground">
                    Pagamento instantâneo via QR Code
                  </p>
                </div>
                {selected === "pix" && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            </Card>

            <Card
              className={cn(
                "p-4 cursor-pointer transition-all border-2",
                selected === "card" 
                  ? "border-primary bg-primary/5" 
                  : "border-transparent hover:border-muted-foreground/30"
              )}
              onClick={() => setSelected("card")}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  selected === "card" ? "bg-primary text-primary-foreground" : "bg-secondary"
                )}>
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Cartão de Crédito</h3>
                  <p className="text-sm text-muted-foreground">
                    Pague em até 12x sem juros
                  </p>
                </div>
                {selected === "card" && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleContinue} 
            disabled={!selected}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
