import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScanFace, Trash2, Loader2, Camera, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/supabase";
import { toast } from "sonner";

interface FaceRecognitionFieldProps {
  currentFaceUrl: string | null;
  onFaceChange: (url: string | null) => void;
}

export function FaceRecognitionField({ currentFaceUrl, onFaceChange }: FaceRecognitionFieldProps) {
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Attach stream to video element once it's rendered
  useEffect(() => {
    if (capturing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [capturing]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      setCapturing(true);
      setCapturedImage(null);
    } catch (error) {
      console.error("Erro ao acessar câmera:", error);
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCapturing(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleSave = async () => {
    if (!capturedImage) return;

    setSaving(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Convert data URL to blob
      const res = await fetch(capturedImage);
      const blob = await res.blob();

      const fileName = `${user.id}/face-recognition-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("driver-licenses")
        .upload(fileName, blob, { contentType: "image/png", upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("driver-licenses")
        .getPublicUrl(fileName);

      // Update profile with face_recognition_url
      const { error: updateError } = await supabase
        .from("oli_profiles")
        .update({ face_recognition_url: publicUrl } as any)
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Send to the same webhook used for driver license
      try {
        const formData = new FormData();
        formData.append("face_photo", blob, "face-recognition.png");
        formData.append("payload", JSON.stringify({
          user_id: user.id,
          event: "face_recognition",
          face_recognition_url: publicUrl,
          timestamp: new Date().toISOString(),
        }));
        formData.append("_webhook_target", "cnhcheck");

        await supabase.functions.invoke("webhook-proxy", {
          body: formData,
        });
      } catch (webhookErr) {
        console.warn("Webhook de reconhecimento facial falhou (não crítico):", webhookErr);
      }

      onFaceChange(publicUrl);
      setCapturedImage(null);
      toast.success("Reconhecimento facial salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar reconhecimento facial:", error);
      toast.error("Erro ao salvar reconhecimento facial");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("oli_profiles")
        .update({ face_recognition_url: null } as any)
        .eq("id", user.id);

      if (error) throw error;

      onFaceChange(null);
      toast.success("Reconhecimento facial removido");
    } catch (error) {
      console.error("Erro ao remover reconhecimento facial:", error);
      toast.error("Erro ao remover reconhecimento facial");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    stopCamera();
    setCapturedImage(null);
  };

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="bg-primary/5 rounded-t-lg">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <ScanFace className="w-4 h-4 text-primary" />
          </div>
          Reconhecimento Facial
        </CardTitle>
        <CardDescription>
          Sua foto facial será usada para verificação de identidade
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {currentFaceUrl && !capturing && !capturedImage ? (
          <div className="space-y-4">
            <div className="border-2 border-border rounded-lg p-4 bg-white flex justify-center">
              <img
                src={currentFaceUrl}
                alt="Reconhecimento facial"
                className="max-h-40 rounded-lg object-cover"
              />
            </div>
            <div className="flex items-center gap-2 justify-center text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Reconhecimento facial registrado
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={startCamera}
              >
                <Camera className="w-4 h-4" />
                Refazer
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : capturing ? (
          <div className="space-y-4">
            <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-48 object-cover"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Posicione seu rosto no centro da câmera
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button className="flex-1 gap-2" onClick={capturePhoto}>
                <Camera className="w-4 h-4" />
                Capturar
              </Button>
            </div>
          </div>
        ) : capturedImage ? (
          <div className="space-y-4">
            <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-white flex justify-center">
              <img
                src={capturedImage}
                alt="Foto capturada"
                className="max-h-48 rounded object-cover"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); startCamera(); }}>
                Refazer
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <ScanFace className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Nenhum reconhecimento facial cadastrado
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={startCamera}
            >
              <Camera className="w-4 h-4" />
              Iniciar Reconhecimento Facial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
