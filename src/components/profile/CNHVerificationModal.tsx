import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

interface CNHVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CNHVerificationModal({ open, onOpenChange }: CNHVerificationModalProps) {
  const navigate = useNavigate();

  const handleSendCNH = () => {
    onOpenChange(false);
    navigate("/profile/driver-license");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-yellow-600" />
          </div>
          <DialogTitle className="text-xl">Verificação de CNH necessária</DialogTitle>
          <DialogDescription className="text-base">
            Para reservar um veículo, envie sua CNH para verificação. 
            Este processo é necessário para garantir a segurança de todos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2 mt-4">
          <Button onClick={handleSendCNH} className="w-full h-12 text-base">
            Enviar CNH
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
