import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PenTool, Trash2, Check, Loader2, AlertCircle } from "lucide-react";
import { RentalContract, signContractAsRenter } from "@/lib/contractService";
import { getCurrentUser, getProfile, updateProfile } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: RentalContract | null;
  onSigned?: () => void;
}

export function SignatureModal({ open, onOpenChange, contract, onSigned }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signing, setSigning] = useState(false);
  const [existingSignature, setExistingSignature] = useState<string | null>(null);
  const [useExisting, setUseExisting] = useState(false);

  useEffect(() => {
    if (open) {
      loadExistingSignature();
      initCanvas();
    }
  }, [open]);

  const loadExistingSignature = async () => {
    const { user } = await getCurrentUser();
    if (!user) return;

    const profile = await getProfile(user.id);
    if (profile && (profile as any).signature_url) {
      setExistingSignature((profile as any).signature_url);
    }
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setUseExisting(false);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setUseExisting(false);
  };

  const handleSign = async () => {
    if (!contract) return;

    // Check if has signature (drawn or existing)
    if (!hasSignature && !useExisting) {
      toast.error("Por favor, desenhe sua assinatura ou use a assinatura salva");
      return;
    }

    setSigning(true);

    try {
      let signatureUrl = existingSignature;

      // If drew a new signature, upload it
      if (hasSignature && !useExisting) {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas não encontrado");

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("Erro ao converter assinatura"));
          }, "image/png");
        });

        const { user } = await getCurrentUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Upload signature
        const fileName = `${user.id}/signature-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from("driver-licenses")
          .upload(fileName, blob, { contentType: "image/png", upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("driver-licenses")
          .getPublicUrl(fileName);

        signatureUrl = publicUrl;

        // Save signature to profile
        await updateProfile(user.id, { signature_url: signatureUrl });
      }

      // Sign the contract
      const success = await signContractAsRenter(contract.id);
      
      if (success) {
        toast.success("Contrato assinado com sucesso!");
        onSigned?.();
        onOpenChange(false);
      } else {
        throw new Error("Erro ao assinar contrato");
      }
    } catch (error) {
      console.error("Erro ao assinar:", error);
      toast.error("Erro ao processar assinatura");
    } finally {
      setSigning(false);
    }
  };

  const handleUseExisting = () => {
    setUseExisting(true);
    setHasSignature(false);
    clearCanvas();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5" />
            Assinatura Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ao assinar, você confirma que leu e concorda com todos os termos do contrato de locação.
          </p>

          {/* Existing signature option */}
          {existingSignature && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Assinatura salva:</p>
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  useExisting ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onClick={handleUseExisting}
              >
                <img 
                  src={existingSignature} 
                  alt="Assinatura salva" 
                  className="max-h-16 mx-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Clique para usar esta assinatura
              </p>
            </div>
          )}

          {existingSignature && <Separator />}

          {/* Draw new signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {existingSignature ? "Ou desenhe uma nova:" : "Desenhe sua assinatura:"}
              </p>
              {hasSignature && (
                <Button variant="ghost" size="sm" onClick={clearCanvas}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div 
              className={`border-2 rounded-lg overflow-hidden ${
                hasSignature && !useExisting ? "border-primary" : "border-border"
              }`}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-32 cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Use o mouse ou o dedo para desenhar sua assinatura
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Esta assinatura tem valor legal. Certifique-se de que leu o contrato antes de assinar.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSign} 
            disabled={signing || (!hasSignature && !useExisting)}
            className="gap-2"
          >
            {signing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Confirmar Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
