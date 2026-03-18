import { useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Clock3, Loader2, RefreshCw, ScanFace, ShieldCheck, Trash2, XCircle } from "lucide-react";
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

interface FaceRecognitionFieldProps {
  currentFaceUrl: string | null;
  validation?: FaceValidationInfo | null;
  onFaceChange: (payload: {
    url: string | null;
    status?: FaceValidationStatus;
    score?: number | null;
    provider?: string | null;
    requestedAt?: string | null;
    validatedAt?: string | null;
    referenceId?: string | null;
  }) => void;
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
        description: "Biometria aprovada. Sua identidade facial está pronta para uso.",
      };
    case "pending":
      return {
        label: "Em análise",
        tone: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock3,
        description: "Foto enviada. A validação está aguardando retorno do provedor.",
      };
    case "needs_review":
      return {
        label: "Revisão manual",
        tone: "bg-sky-50 text-sky-700 border-sky-200",
        icon: AlertCircle,
        description: "Recebemos a selfie, mas ela precisa de análise complementar.",
      };
    case "rejected":
      return {
        label: "Reprovado",
        tone: "bg-rose-50 text-rose-700 border-rose-200",
        icon: XCircle,
        description: "A selfie foi recusada. Faça uma nova captura com boa iluminação.",
      };
    case "error":
      return {
        label: "Falha no envio",
        tone: "bg-red-50 text-red-700 border-red-200",
        icon: AlertCircle,
        description: "Não foi possível concluir a validação facial automaticamente.",
      };
    default:
      return {
        label: "Não enviado",
        tone: "bg-muted text-muted-foreground border-border",
        icon: ScanFace,
        description: "Capture uma selfie para iniciar sua validação de identidade.",
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
  const [saving, setSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const normalizedStatus = normalizeStatus(validation?.status);
  const statusMeta = useMemo(() => getStatusMeta(normalizedStatus), [normalizedStatus]);
  const scorePercent = formatScore(validation?.score);
  const StatusIcon = statusMeta.icon;

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCapturing(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCapturing(true);
      setCapturedImage(null);
    } catch (error) {
      console.error("Erro ao acessar câmera:", error);
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
    }
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

      const res = await fetch(capturedImage);
      const blob = await res.blob();

      const fileName = `${user.id}/face-validation-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("driver-licenses")
        .upload(fileName, blob, { contentType: "image/png", upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("driver-licenses")
        .getPublicUrl(fileName);

      const requestedAt = new Date().toISOString();
      const provider = "datavalid_n8n_async";
      const { data: profileSnapshot } = await supabase
        .from("oli_profiles")
        .select("id, full_name, cpf, birth_date, email, phone, whatsapp_phone")
        .eq("id", user.id)
        .maybeSingle();

      const sanitizedCpf = String(profileSnapshot?.cpf || "").replace(/\D/g, "") || null;
      const faceRequestPayload = {
        user_id: user.id,
        event: "face_validation_requested",
        provider: "datavalid",
        provider_mode: "async_callback",
        requested_at: requestedAt,
        reference_id: `oli-face-${user.id}-${Date.now()}`,
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
        face_image: {
          storage_path: fileName,
          content_type: "image/png",
          file_name: "face-validation.png",
          public_url: publicUrl,
        },
        face_recognition_url: publicUrl,
        integration_notes: "Preferred production path: async n8n orchestration with DataValid request + callback reconciliation by reference_id.",
      };

      const updatePayload = {
        face_recognition_url: publicUrl,
        face_validation_status: "pending",
        face_validation_score: null,
        face_validation_provider: provider,
        face_validation_requested_at: requestedAt,
        face_validation_validated_at: null,
        face_validation_reference_id: faceRequestPayload.reference_id,
        face_validation_payload: {
          source: "profile_meus_dados",
          integration_mode: "n8n_datavalid_async_callback",
          provider_hint: "DataValid",
          last_uploaded_file: fileName,
          request_payload: faceRequestPayload,
        },
      };

      const { error: updateError } = await supabase
        .from("oli_profiles")
        .update(updatePayload)
        .eq("id", user.id);

      if (updateError) throw updateError;

      let resolvedStatus: FaceValidationStatus = "pending";
      let resolvedScore: number | null = null;
      let resolvedProvider = provider;
      let resolvedValidatedAt: string | null = null;
      let resolvedReferenceId = faceRequestPayload.reference_id;

      try {
        const formData = new FormData();
        formData.append("face_photo", blob, "face-validation.png");
        formData.append("payload", JSON.stringify(faceRequestPayload));
        formData.append("_webhook_target", "oli-face-validation");

        const webhookUrl = "https://n8n.srv1153225.hstgr.cloud/webhook/oli-face-validation";

        let webhookData: unknown = null;
        let webhookError: unknown = null;

        try {
          const directResponse = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
          });

          if (!directResponse.ok) {
            throw new Error(`HTTP ${directResponse.status}`);
          }

          webhookData = await directResponse.json().catch(() => null);
        } catch (directErr) {
          console.warn("Webhook direto do n8n falhou, tentando proxy Supabase:", directErr);

          const fallback = await supabase.functions.invoke("webhook-proxy", {
            body: formData,
          });

          webhookData = fallback.data;
          webhookError = fallback.error;
        }

        if (webhookError) {
          console.warn("Webhook de validação facial falhou (não crítico):", webhookError);
        } else if (webhookData && typeof webhookData === "object") {
          const response = webhookData as {
            status?: string;
            provider?: string;
            reference_id?: string;
            message?: string;
            response?: { score?: number | null };
          };

          const normalizedWebhookStatus = normalizeStatus(response.status ?? null);
          resolvedStatus = normalizedWebhookStatus;
          resolvedProvider = response.provider || resolvedProvider;
          resolvedReferenceId = response.reference_id || resolvedReferenceId;
          resolvedScore = response.response?.score ?? null;
          resolvedValidatedAt = ["approved", "rejected", "needs_review", "error"].includes(normalizedWebhookStatus)
            ? new Date().toISOString()
            : null;

          if (normalizedWebhookStatus === "error") {
            await supabase
              .from("oli_profiles")
              .update({
                face_validation_status: "error",
                face_validation_provider: resolvedProvider,
                face_validation_validated_at: resolvedValidatedAt,
                face_validation_reference_id: resolvedReferenceId,
                face_validation_payload: {
                  source: "profile_meus_dados",
                  integration_mode: "n8n_datavalid_async_callback",
                  provider_hint: "DataValid",
                  last_uploaded_file: fileName,
                  request_payload: faceRequestPayload,
                  webhook_response: response,
                },
              })
              .eq("id", user.id);
          }
        }
      } catch (webhookErr) {
        console.warn("Webhook de validação facial falhou (não crítico):", webhookErr);
      }

      onFaceChange({
        url: publicUrl,
        status: resolvedStatus,
        score: resolvedScore,
        provider: resolvedProvider,
        requestedAt,
        validatedAt: resolvedValidatedAt,
        referenceId: resolvedReferenceId,
      });
      setCapturedImage(null);
      toast.success(resolvedStatus === "approved" ? "Selfie validada com sucesso!" : resolvedStatus === "needs_review" ? "Selfie enviada. Ela foi encaminhada para revisão complementar." : resolvedStatus === "rejected" ? "Selfie enviada, mas foi reprovada. Faça uma nova captura." : resolvedStatus === "error" ? "Selfie salva, mas houve falha no envio automático para validação." : "Selfie enviada! Agora a validação facial está em análise.");
    } catch (error) {
      console.error("Erro ao salvar validação facial:", error);
      toast.error("Erro ao salvar validação facial");
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
        .update({
          face_recognition_url: null,
          face_validation_status: "not_sent",
          face_validation_score: null,
          face_validation_provider: null,
          face_validation_requested_at: null,
          face_validation_validated_at: null,
          face_validation_reference_id: null,
          face_validation_payload: null,
        })
        .eq("id", user.id);

      if (error) throw error;

      onFaceChange({
        url: null,
        status: "not_sent",
        score: null,
        provider: null,
        requestedAt: null,
        validatedAt: null,
        referenceId: null,
      });
      toast.success("Validação facial removida");
    } catch (error) {
      console.error("Erro ao remover validação facial:", error);
      toast.error("Erro ao remover validação facial");
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
      <CardHeader className="bg-primary/5 rounded-t-lg space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ScanFace className="w-4 h-4 text-primary" />
              </div>
              Validação Facial
            </CardTitle>
            <CardDescription>
              Capture uma selfie para verificação de identidade. O contrato continua sendo assinado via Clicksign, separadamente.
            </CardDescription>
          </div>
          <Badge variant="outline" className={statusMeta.tone}>
            <StatusIcon className="w-3.5 h-3.5 mr-1" />
            {statusMeta.label}
          </Badge>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {statusMeta.description}
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {(currentFaceUrl || validation?.provider || validation?.requestedAt || validation?.validatedAt) && (
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
                  <span className="text-muted-foreground">Score de correspondência</span>
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
              <img src={currentFaceUrl} alt="Selfie de validação facial" className="max-h-48 rounded-lg object-cover" />
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Selfie cadastrada para validação de identidade
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                <RefreshCw className="w-4 h-4" />
                Refazer selfie
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
              <p>Centralize o rosto, retire óculos escuros e use boa iluminação.</p>
              <p>Evite boné, máscara e fundo muito escuro.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>Cancelar</Button>
              <Button type="button" className="flex-1 gap-2" onClick={capturePhoto}>
                <Camera className="w-4 h-4" />
                Capturar selfie
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
                Ao confirmar, a selfie ficará com status <strong>Em análise</strong> até o retorno do fluxo n8n/DataValid.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); startCamera(); }}>
                Refazer
              </Button>
              <Button type="button" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Enviar para validação
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <ScanFace className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma selfie enviada para validação facial</p>
            </div>
            <Button type="button" variant="outline" className="w-full gap-2" onClick={startCamera}>
              <Camera className="w-4 h-4" />
              Iniciar validação facial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
