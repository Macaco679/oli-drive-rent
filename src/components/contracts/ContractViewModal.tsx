import { useState, useEffect } from "react";
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
import { FileText, Send, Loader2, Check, PenTool } from "lucide-react";
import { 
  ContractData, 
  generateContractText, 
  createContract, 
  getContractByRentalId,
  RentalContract 
} from "@/lib/contractService";
import { getProfileById, getVehicleById, OliRental, OliVehicle, OliProfile } from "@/lib/supabase";
import { toast } from "sonner";

interface ContractViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: (OliRental & { vehicle?: OliVehicle }) | null;
  mode: "owner" | "renter"; // owner = enviar, renter = assinar
  onContractSent?: () => void;
  onContractSign?: (contract: RentalContract) => void;
}

export function ContractViewModal({ 
  open, 
  onOpenChange, 
  rental, 
  mode,
  onContractSent,
  onContractSign 
}: ContractViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contractText, setContractText] = useState("");
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [owner, setOwner] = useState<OliProfile | null>(null);
  const [renter, setRenter] = useState<OliProfile | null>(null);

  useEffect(() => {
    if (open && rental) {
      loadContractData();
    }
  }, [open, rental]);

  const loadContractData = async () => {
    if (!rental) return;
    setLoading(true);

    try {
      // Buscar dados do proprietário e locatário
      const [ownerData, renterData, existingContract] = await Promise.all([
        getProfileById(rental.owner_id),
        getProfileById(rental.renter_id),
        getContractByRentalId(rental.id),
      ]);

      setOwner(ownerData);
      setRenter(renterData);
      setContract(existingContract);

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
    } catch (error) {
      console.error("Erro ao carregar dados do contrato:", error);
      toast.error("Erro ao carregar dados do contrato");
    } finally {
      setLoading(false);
    }
  };

  const handleSendContract = async () => {
    if (!rental) return;
    setSending(true);

    try {
      const newContract = await createContract(rental.id);
      if (newContract) {
        setContract(newContract);
        toast.success("Contrato enviado com sucesso! O locatário poderá visualizar e assinar.");
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

  const handleSignContract = () => {
    if (contract) {
      onContractSign?.(contract);
    }
  };

  if (!rental) return null;

  const hasContract = contract !== null;
  const isSigned = hasContract && contract.renter_signed_at !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {mode === "owner" ? "Revisar e Enviar Contrato" : "Contrato de Locação"}
            {hasContract && (
              <Badge variant={isSigned ? "default" : "secondary"} className="ml-2">
                {isSigned ? "Assinado" : "Pendente assinatura"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="bg-secondary/30 rounded-lg p-6 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {contractText}
              </div>
            </ScrollArea>

            <Separator className="my-4" />

            <DialogFooter className="flex-col sm:flex-row gap-2">
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
                  {hasContract && !isSigned && (
                    <Button onClick={handleSignContract} className="gap-2">
                      <PenTool className="w-4 h-4" />
                      Assinar Contrato
                    </Button>
                  )}
                  {isSigned && (
                    <Badge variant="default" className="px-4 py-2">
                      <Check className="w-4 h-4 mr-2" />
                      Contrato Assinado
                    </Badge>
                  )}
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
