import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PenTool, Trash2, Check, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, updateProfile } from "@/lib/supabase";
import { toast } from "sonner";

interface SignatureFieldProps {
  currentSignature: string | null;
  onSignatureChange: (url: string | null) => void;
}

export function SignatureField({ currentSignature, onSignatureChange }: SignatureFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    if (showCanvas) {
      initCanvas();
    }
  }, [showCanvas]);

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
    setHasDrawn(true);
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
    setHasDrawn(false);
  };

  const handleSaveSignature = async () => {
    if (!hasDrawn) {
      toast.error("Por favor, desenhe sua assinatura");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
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

      // Update profile
      await updateProfile(user.id, { signature_url: publicUrl });
      
      onSignatureChange(publicUrl);
      setShowCanvas(false);
      setHasDrawn(false);
      toast.success("Assinatura salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar assinatura:", error);
      toast.error("Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSignature = async () => {
    setSaving(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado");

      await updateProfile(user.id, { signature_url: null });
      onSignatureChange(null);
      toast.success("Assinatura removida");
    } catch (error) {
      console.error("Erro ao remover assinatura:", error);
      toast.error("Erro ao remover assinatura");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="bg-primary/5 rounded-t-lg">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <PenTool className="w-4 h-4 text-primary" />
          </div>
          Assinatura Digital
        </CardTitle>
        <CardDescription>
          Sua assinatura será usada em contratos de locação
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {currentSignature && !showCanvas ? (
          <div className="space-y-4">
            <div className="border-2 border-border rounded-lg p-4 bg-white">
              <img 
                src={currentSignature} 
                alt="Sua assinatura" 
                className="max-h-24 mx-auto"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => setShowCanvas(true)}
              >
                <PenTool className="w-4 h-4" />
                Alterar
              </Button>
              <Button 
                variant="destructive" 
                size="icon"
                onClick={handleDeleteSignature}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : showCanvas ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Desenhe sua assinatura:</p>
              {hasDrawn && (
                <Button variant="ghost" size="sm" onClick={clearCanvas}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-white">
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
              Use o mouse ou o dedo para desenhar
            </p>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowCanvas(false);
                  setHasDrawn(false);
                }}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 gap-2"
                onClick={handleSaveSignature}
                disabled={saving || !hasDrawn}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Salvar Assinatura
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <PenTool className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Nenhuma assinatura cadastrada
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={() => setShowCanvas(true)}
            >
              <Upload className="w-4 h-4" />
              Adicionar Assinatura
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
