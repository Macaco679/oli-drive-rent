import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type FaceValidationStatus = "not_sent" | "pending" | "approved" | "rejected" | "needs_review" | "error";

interface FaceValidationInfo {
  status?: string | null;
  score?: number | null;
  provider?: string | null;
  requestedAt?: string | null;
  validatedAt?: string | null;
  referenceId?: string | null;
}

interface FaceValidationPayload {
  url: string | null;
  status?: FaceValidationStatus;
  score?: number | null;
  provider?: string | null;
  requestedAt?: string | null;
  validatedAt?: string | null;
  referenceId?: string | null;
}

interface FaceRecognitionFieldProps {
  currentFaceUrl: string | null;
  validation?: FaceValidationInfo | null;
  onFaceChange: ((url: string | null) => void) | ((payload: FaceValidationPayload) => void);
}

const normalizeStatus = (status?: string | null): FaceValidationStatus => {
  switch (status) {
    case "pending":
    case "approved":
    case "rejected":
    case "needs_review":
    case "error":
      return status;
    default:
      return "not_sent";
  }
};

const getStatusMeta = (status: FaceValidationStatus) => {
  switch (status) {
    case "approved":
      return {
        label: "Validado",
        tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: ShieldCheck,
        description: "Biometria aprovada. Sua identidade facial est\u00e1 pronta para uso.",
      };
    case "pending":
      return {
        label: "Em an\u00e1lise",
        tone: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock3,
        description: "Foto enviada. A valida\u00e7\u00e3o est\u00e1 aguardando retorno do provedor.",
      };
    case "needs_review":
      return {
        label: "Revis\u00e3o manual",
        tone: "bg-sky-50 text-sky-700 border-sky-200",
        icon: AlertCircle,
        description: "Recebemos a selfie, mas ela precisa de an\u00e1lise complementar.",
      };
    case "rejected":
      return {
        label: "Reprovado",
        tone: "bg-rose-50 text-rose-700 border-rose-200",
        icon: XCircle,
        description: "A selfie foi recusada. Fa\u00e7a uma nova captura com boa ilumina\u00e7\u00e3o.",
      };
    case "error":
      return {
        label: "Falha no envio",
        tone: "bg-red-50 text-red-700 border-red-200",
        icon: AlertCircle,
        description: "N\u00e3o foi poss\u00edvel concluir a valida\u00e7\u00e3o facial autom\u00e1tica.",
      };
    default:
      return {
        label: "N\u00e3o enviado",
        tone: "bg-muted text-muted-foreground border-border",
        icon: ScanFace,
        description: "Capture uma selfie ou envie uma foto para iniciar sua valida\u00e7\u00e3o de identidade.",
      };
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatScore = (score?: number | null) => {
  if (score == null || Number.isNaN(score)) return null;
  if (score <= 1) return Math.round(score * 100);
  return Math.round(score);
};

export function FaceRecognitionField({ currentFaceUrl, validation, onFaceChange }: FaceRecognitionFieldProps) {
  const [capturing, setCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [saving, setSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedStatus = normalizeStatus(validation?.status);
  const statusMeta = useMemo(() => getStatusMeta(normalizedStatus), [normalizedStatus]);
  const scorePercent = formatScore(validation?.score);
  const StatusIcon = statusMeta.icon;
  const supportsPayload = validation !== undefined;

  const emitChange = (payload: FaceValidationPayload) => {
    if (supportsPayload) {
      (onFaceChange as (payload: FaceValidationPayload) => void)(payload);
      return;
    }
    (onFaceChange as (url: string | null) => void)(payload.url);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCapturing(false);
  };

  // Attach stream to video element once both are available
  useEffect(() => {
    if (capturing && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.play().catch((err) => {
        console.warn("Camera playback error:", err);
      });
    }
    return () => {
      if (stream && !capturing) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [capturing, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCapturing(true);
      setStream(mediaStream);
      setCapturedImage(null);
    } catch (error) {
      console.warn("Camera error:", error);
      toast.info("N\u00e3o foi poss\u00edvel acessar a c\u00e2mera. Use a op\u00e7\u00e3o de upload de arquivo.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecione uma imagem.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (loadEvent.target?.result) {
        setCapturedImage(loadEvent.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSave = async () => {
    if (!capturedImage) return;

    setSaving(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) throw new Error("Usu\u00e1rio n\u00e3o autenticado");

      const imageResponse = await fetch(capturedImage);
      const blob = await imageResponse.blob();
      const mimeType = blob.type || "image/jpeg";
      const extension = mimeType.includes("png") ? "png" : "jpg";
      const fileName = `${user.id}/face-validation-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("driver-licenses")
        .upload(fileName, blob, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("driver-licenses").getPublicUrl(fileName);

      const requestedAt = new Date().toISOString();
      const referenceId = `oli-face-${user.id}-${Date.now()}`;
      const provider = "datavalid_n8n_async";

      const { data: profileSnapshot } = await supabase
        .from("oli_profiles")
        .select("id, full_name, cpf, birth_date, email, phone, whatsapp_phone")
        .eq("id", user.id)
        .maybeSingle();

      const sanitizedCpf = String(profileSnapshot?.cpf || "").replace(/\D/g, "") || null;

      await supabase
        .from("oli_profiles")
        .update({
          face_recognition_url: publicUrl,
          face_validation_status: "pending",
          face_validation_score: null,
          face_validation_provider: provider,
          face_validation_requested_at: requestedAt,
          face_validation_validated_at: null,
          face_validation_reference_id: referenceId,
        })
        .eq("id", user.id);

      const faceRequestPayload = {
        user_id: user.id,
        event: "face_validation_requested",
        provider: "datavalid",
        provider_mode: "async_callback",
        requested_at: requestedAt,
        reference_id: referenceId,
        callback_path: "/webhook/oli-face-validation-callback",
        callback_header_name: "x-oli-face-secret",
        person: {
          id: user.id,
          name: profileSnapshot?.full_name || null,
          cpf: sanitizedCpf,
          birth_date: profileSnapshot?.birth_date || null,
          email: profileSnapshot?.email || null,
          phone: profileSnapshot?.phone || profileSnapshot?.whatsapp_phone || null,
        },
        face_recognition_url: publicUrl,
        face_image: {
          storage_path: fileName,
          content_type: mimeType,
          public_url: publicUrl,
        },
      };

      let resolvedStatus: FaceValidationStatus = "pending";
      let resolvedScore: number | null = null;
      let resolvedValidatedAt: string | null = null;

      try {
        const webhookUrl = "https://n8n.srv1153225.hstgr.cloud/webhook/oli-face-validation";
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(faceRequestPayload),
        });

        if (webhookResponse.ok) {
          const webhookData = await webhookResponse.json().catch(() => null);
          if (webhookData && typeof webhookData === "object") {
            const payload = webhookData as {
              status?: string;
              face_validation_status?: string;
              score?: number | null;
              face_validation_score?: number | null;
            };

            const webhookStatus = payload.face_validation_status || payload.status;
            resolvedStatus = normalizeStatus(webhookStatus ?? null);
            resolvedScore = payload.face_validation_score ?? payload.score ?? null;
            resolvedValidatedAt = ["approved", "rejected", "needs_review", "error"].includes(resolvedStatus)
              ? new Date().toISOString()
              : null;
          }
        }
      } catch (webhookError) {
        console.warn("n8n webhook call failed (non-critical):", webhookError);
      }

      if (resolvedStatus !== "pending") {
        await supabase
          .from("oli_profiles")
          .update({
            face_validation_status: resolvedStatus,
            face_validation_score: resolvedScore,
            face_validation_validated_at: resolvedValidatedAt,
          } as any)
          .eq("id", user.id);
      }

      emitChange({
        url: publicUrl,
        status: resolvedStatus,
        score: resolvedScore,
        provider,
        requestedAt,
        validatedAt: resolvedValidatedAt,
        referenceId,
      });

      setCapturedImage(null);

      toast.success(
        resolvedStatus === "approved"
          ? "Selfie validada com sucesso!"
          : resolvedStatus === "rejected"
            ? "Selfie enviada, mas foi reprovada. Fa\u00e7a uma nova captura."
            : resolvedStatus === "error"
              ? "Selfie salva, mas houve falha na valida\u00e7\u00e3o autom\u00e1tica."
              : "Selfie enviada! Valida\u00e7\u00e3o facial em an\u00e1lise.",
      );
    } catch (error) {
      console.error("Erro ao salvar valida\u00e7\u00e3o facial:", error);
      toast.error("Erro ao salvar valida\u00e7\u00e3o facial");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) throw new Error("Usu\u00e1rio n\u00e3o autenticado");

      await supabase
        .from("oli_profiles")
        .update({
          face_recognition_url: null,
          face_validation_status: "not_sent",
          face_validation_score: null,
          face_validation_provider: null,
          face_validation_requested_at: null,
          face_validation_validated_at: null,
          face_validation_reference_id: null,
        })
        .eq("id", user.id);

      emitChange({
        url: null,
        status: "not_sent",
        score: null,
        provider: null,
        requestedAt: null,
        validatedAt: null,
        referenceId: null,
      });

      toast.success("Valida\u00e7\u00e3o facial removida");
    } catch (error) {
      console.error("Erro ao remover:", error);
      toast.error("Erro ao remover valida\u00e7\u00e3o facial");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    stopCamera();
    setCapturedImage(null);
  };

  const renderFileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="user"
      className="hidden"
      onChange={handleFileSelected}
    />
  );

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="bg-primary/5 rounded-t-lg space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ScanFace className="w-4 h-4 text-primary" />
              </div>
              Valida\u00e7\u00e3o Facial
            </CardTitle>
            <CardDescription>
              Capture ou envie uma selfie para verifica\u00e7\u00e3o de identidade.
            </CardDescription>
          </div>
          <Badge variant="outline" className={statusMeta.tone}>
            <StatusIcon className="w-3.5 h-3.5 mr-1" />
            {statusMeta.label}
          </Badge>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statusMeta.description}</AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {renderFileInput()}

        {(currentFaceUrl || validation?.provider || validation?.requestedAt) && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Provedor</p>
                <p className="font-medium">{validation?.provider || "Aguardando envio"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Solicitado em</p>
                <p className="font-medium">{formatDateTime(validation?.requestedAt) || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Validado em</p>
                <p className="font-medium">{formatDateTime(validation?.validatedAt) || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Protocolo</p>
                <p className="font-medium break-all">{validation?.referenceId || "-"}</p>
              </div>
            </div>
            {scorePercent != null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Score de correspond\u00eancia</span>
                  <span className="font-semibold">{scorePercent}%</span>
                </div>
                <Progress value={scorePercent} className="h-2" />
              </div>
            )}
          </div>
        )}

        {currentFaceUrl && !capturing && !capturedImage ? (
          <div className="space-y-4">
            <div className="border-2 border-border rounded-lg p-4 bg-white flex justify-center">
              <img src={currentFaceUrl} alt="Selfie de valida\u00e7\u00e3o facial" className="max-h-48 rounded-lg object-cover" />
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Selfie cadastrada para valida\u00e7\u00e3o de identidade
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                <RefreshCw className="w-4 h-4" /> Refazer com c\u00e2mera
              </Button>
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Enviar arquivo
              </Button>
              <Button type="button" variant="destructive" size="icon" onClick={handleDelete} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : capturing ? (
          <div className="space-y-4">
            <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
            </div>
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>Centralize o rosto, retire \u00f3culos escuros e use boa ilumina\u00e7\u00e3o.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1 gap-2" onClick={capturePhoto}>
                <Camera className="w-4 h-4" /> Capturar selfie
              </Button>
            </div>
          </div>
        ) : capturedImage ? (
          <div className="space-y-4">
            <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-white flex justify-center">
              <img src={capturedImage} alt="Selfie capturada" className="max-h-48 rounded object-cover" />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ao confirmar, a selfie ficar\u00e1 com status <strong>Em an\u00e1lise</strong> at\u00e9 o retorno da valida\u00e7\u00e3o.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCapturedImage(null)}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Enviar para valida\u00e7\u00e3o
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <ScanFace className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma selfie enviada para valida\u00e7\u00e3o facial</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                <Camera className="w-4 h-4" /> Usar c\u00e2mera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" /> Enviar arquivo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
