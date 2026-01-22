import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, getMyRentalsAsRenter, getMyRentalsAsOwner, getVehicleById, OliRental, OliVehicle } from "@/lib/supabase";
import { RentalContract } from "@/lib/contractService";
import { Car } from "lucide-react";
import { RentalCardRenter } from "@/components/reservations/RentalCardRenter";
import { RentalCardOwner } from "@/components/reservations/RentalCardOwner";
import { RentalDetailsModal } from "@/components/reservations/RentalDetailsModal";
import { ContractViewModal } from "@/components/contracts/ContractViewModal";
import { SignatureModal } from "@/components/contracts/SignatureModal";
import { toast } from "sonner";

interface RentalWithVehicle extends OliRental {
  vehicle?: OliVehicle;
}

export default function Reservations() {
  const [asRenter, setAsRenter] = useState<RentalWithVehicle[]>([]);
  const [asOwner, setAsOwner] = useState<RentalWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [selectedRental, setSelectedRental] = useState<RentalWithVehicle | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [contractMode, setContractMode] = useState<"owner" | "renter">("owner");
  const [selectedContract, setSelectedContract] = useState<RentalContract | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    loadRentals();
  }, []);

  const loadRentals = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const [renterRentals, ownerRentals] = await Promise.all([
      getMyRentalsAsRenter(user.id),
      getMyRentalsAsOwner(user.id),
    ]);

    const renterWithVehicles = await Promise.all(
      renterRentals.map(async (rental) => {
        const vehicle = await getVehicleById(rental.vehicle_id);
        return { ...rental, vehicle: vehicle || undefined };
      })
    );

    const ownerWithVehicles = await Promise.all(
      ownerRentals.map(async (rental) => {
        const vehicle = await getVehicleById(rental.vehicle_id);
        return { ...rental, vehicle: vehicle || undefined };
      })
    );

    setAsRenter(renterWithVehicles);
    setAsOwner(ownerWithVehicles);
    setLoading(false);
  };

  // Owner actions
  const handleOwnerCardClick = (rental: RentalWithVehicle) => {
    setSelectedRental(rental);
    setShowDetailsModal(true);
  };

  const handleSendContract = (rental: RentalWithVehicle) => {
    setSelectedRental(rental);
    setContractMode("owner");
    setShowContractModal(true);
  };

  // Renter actions
  const handleViewContract = (rental: RentalWithVehicle, contract: RentalContract | null) => {
    setSelectedRental(rental);
    setContractMode("renter");
    setShowContractModal(true);
  };

  const handleSignContract = (rental: RentalWithVehicle, contract: RentalContract) => {
    setSelectedRental(rental);
    setSelectedContract(contract);
    // First show contract, then signature
    setContractMode("renter");
    setShowContractModal(true);
  };

  const handleOpenSignature = (contract: RentalContract) => {
    setSelectedContract(contract);
    setShowContractModal(false);
    setShowSignatureModal(true);
  };

  const handlePay = () => {
    toast.info("Funcionalidade de pagamento em desenvolvimento");
  };

  const handleContractSent = () => {
    toast.success("Contrato enviado! O locatário pode visualizar e assinar.");
    loadRentals();
  };

  const handleContractSigned = () => {
    toast.success("Contrato assinado com sucesso!");
    loadRentals();
  };

  const EmptyState = ({ message, action, onAction }: { message: string; action: string; onAction: () => void }) => (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
        <Car className="w-10 h-10 text-muted-foreground" />
      </div>
      <p className="text-xl text-muted-foreground mb-6">{message}</p>
      <Button onClick={onAction} size="lg">
        {action}
      </Button>
    </div>
  );

  return (
    <WebLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Minhas Reservas</h1>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <Tabs defaultValue="renter" className="w-full">
            <TabsList className="w-full max-w-md grid grid-cols-2 mb-8">
              <TabsTrigger value="renter" className="text-base py-3">Como motorista</TabsTrigger>
              <TabsTrigger value="owner" className="text-base py-3">Como locador</TabsTrigger>
            </TabsList>

            <TabsContent value="renter">
              {asRenter.length === 0 ? (
                <EmptyState
                  message="Você ainda não tem reservas ativas"
                  action="Buscar carros"
                  onAction={() => navigate("/search")}
                />
              ) : (
                <div className="grid gap-6">
                  {asRenter.map((rental) => (
                    <RentalCardRenter 
                      key={rental.id} 
                      rental={rental}
                      onViewContract={(contract) => handleViewContract(rental, contract)}
                      onSignContract={(contract) => handleSignContract(rental, contract)}
                      onPay={handlePay}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="owner">
              {asOwner.length === 0 ? (
                <EmptyState
                  message="Você ainda não tem reservas como locador"
                  action="Ver meus veículos"
                  onAction={() => navigate("/my-vehicles")}
                />
              ) : (
                <div className="grid gap-6">
                  {asOwner.map((rental) => (
                    <RentalCardOwner 
                      key={rental.id} 
                      rental={rental}
                      onClick={() => handleOwnerCardClick(rental)}
                      onSendContract={() => handleSendContract(rental)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modal: Detalhes da reserva (Owner) */}
      <RentalDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        rental={selectedRental}
        onStatusChange={loadRentals}
        onSendContract={() => {
          setShowDetailsModal(false);
          setContractMode("owner");
          setShowContractModal(true);
        }}
      />

      {/* Modal: Visualizar/Enviar Contrato */}
      <ContractViewModal
        open={showContractModal}
        onOpenChange={setShowContractModal}
        rental={selectedRental}
        mode={contractMode}
        onContractSent={handleContractSent}
        onContractSign={handleOpenSignature}
      />

      {/* Modal: Assinatura Digital */}
      <SignatureModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        contract={selectedContract}
        onSigned={handleContractSigned}
      />
    </WebLayout>
  );
}
