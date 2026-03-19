import { useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Clock3, Loader2, RefreshCw, ScanFace, ShieldCheck, Trash2, Upload, XCircle } from "lucide-react";
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
              return { label: "Validado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck, description: "Biometria aprovada. Sua identidade facial está pronta para uso." };
      case "pending":
              return { label: "Em análise", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock3, description: "Foto enviada. A validação está aguardando retorno do provedor." };
      case "needs_review":
              return { label: "Revisão manual", tone: "bg-sky-50 text-sky-700 border-sky-200", icon: AlertCircle, description: "Recebemos a selfie, mas ela precisa de análise complementar." };
      case "rejected":
              return { label: "Reprovado", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle, description: "A selfie foi recusada. Faça uma nova captura com boa iluminação." };
      case "error":
              return { label: "Falha no envio", tone: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle, description: "Não foi possível concluir a validação facial automaticamente." };
      default:
              return { label: "Não enviado", tone: "bg-muted text-muted-foreground border-border", icon: ScanFace, description: "Capture uma selfie ou envie uma foto para iniciar sua validação de identidade." };
    }
};

const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const formatScore = (score?: number | null) => {
    if (score == null || Number.isNaN(score)) return null;
    if (score <= 1) return Math.round(score * 100);
    return Math.round(score);
};

// Check if getUserMedia (camera) is available
// Works only on HTTPS or localhost - falls back to file input on HTTP
const isCameraAvailable = (): boolean => {
    if (typeof navigator === "undefined") return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    const isSecure =
          window.location.protocol === "https:" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";
    return isSecure;
};

export function FaceRecognitionField({ currentFaceUrl, validation, onFaceChange }: FaceRecognitionFieldProps) {
    const [capturing, setCapturing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [useFileInput, setUseFileInput] = useState(!isCameraAvailable());
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!isCameraAvailable()) {
                // No camera available on HTTP - switch to file input mode
          setUseFileInput(true);
                toast.info("Câmera requer HTTPS. Use a opção de upload de arquivo.");
                return;
        }
        try {
                const stream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                });
                streamRef.current = stream;
                if (videoRef.current) {
                          videoRef.current.srcObject = stream;
                }
                setCapturing(true);
                setCapturedImage(null);
        } catch (error: unknown) {
                console.warn("Camera error:", error);
                // Fall back to file input on any camera error
          setUseFileInput(true);
                toast.info("Não foi possível acessar a câmera. Use a opção de upload de arquivo.");
        }
  };

  const capturePhoto = () => {
        const video = videoRef.current;
        if (!video) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(dataUrl);
        stopCamera();
  };

  // Handle file selected via <input type="file">
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
                toast.error("Por favor selecione uma imagem.");
                return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
                if (ev.target?.result) {
                          setCapturedImage(ev.target.result as string);
                }
        };
        reader.readAsDataURL(file);
        // Reset input so the same file can be selected again
        e.target.value = "";
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
                const mimeType = blob.type || "image/jpeg";
                const ext = mimeType.includes("png") ? "png" : "jpg";
                const fileName = `${user.id}/face-validation-${Date.now()}.${ext}`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
                  .from("driver-licenses")
                  .upload(fileName, blob, { contentType: mimeType, upsert: true });
                if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from("driver-licenses").getPublicUrl(fileName);

          const requestedAt = new Date().toISOString();
                const referenceId = `oli-face-${user.id}-${Date.now()}`;
                const provider = "datavalid_n8n_async";

          // Fetch profile data for the request payload
          const { data: profileSnapshot } = await supabase
                  .from("oli_profiles")
                  .select("id, full_name, cpf, birth_date, email, phone, whatsapp_phone")
                  .eq("id", user.id)
                  .maybeSingle();

          const sanitizedCpf = String(profileSnapshot?.cpf || "").replace(/\D/g, "") || null;

          // Update Supabase profile to pending
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

          // Build webhook payload for n8n
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

          // Call n8n webhook (best effort - non-blocking)
          let resolvedStatus: FaceValidationStatus = "pending";
                let resolvedScore: number | null = null;
                let resolvedValidatedAt: string | null = null;

          try {
                    // Send as JSON (works on HTTP, avoids CORS issues with FormData)
                  const webhookUrl = "https://n8n.srv1153225.hstgr.cloud/webhook/oli-face-validation";
                    const webhookResp = await fetch(webhookUrl, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(faceRequestPayload),
                    });

                  if (webhookResp.ok) {
                              const webhookData = await webhookResp.json().catch(() => null);
                              if (webhookData && typeof webhookData === "object") {
                                            const wd = webhookData as {
                                                            status?: string;
                                                            face_validation_status?: string;
                                                            score?: number | null;
                                                            face_validation_score?: number | null;
                                                            reference_id?: string;
                                                            message?: string;
                                            };
                                            const wdStatus = wd.face_validation_status || wd.status;
                                            const normalized = normalizeStatus(wdStatus ?? null);
                                            resolvedStatus = normalized;
                                            resolvedScore = wd.face_validation_score ?? wd.score ?? null;
                                            resolvedValidatedAt =
                                                            ["approved", "rejected", "needs_review", "error"].includes(normalized)
                                                ? new Date().toISOString()
                                                              : null;
                              }
                  }
          } catch (webhookErr) {
                    console.warn("n8n webhook call failed (non-critical):", webhookErr);
          }

          // Update profile with final resolved status
          if (resolvedStatus !== "pending") {
                    await supabase
                      .from("oli_profiles")
                      .update({
                                    face_validation_status: resolvedStatus,
                                    face_validation_score: resolvedScore,
                                    face_validation_validated_at: resolvedValidatedAt,
                      })
                      .eq("id", user.id);
          }

          onFaceChange({
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
                      ? "Selfie enviada, mas foi reprovada. Faça uma nova captura."
                      : resolvedStatus === "error"
                      ? "Selfie salva, mas houve falha na validação automática."
                      : "Selfie enviada! Validação facial em análise."
                  );
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
                onFaceChange({ url: null, status: "not_sent", score: null, provider: null, requestedAt: null, validatedAt: null, referenceId: null });
                toast.success("Validação facial removida");
        } catch (error) {
                console.error("Erro ao remover:", error);
                toast.error("Erro ao remover validação facial");
        } finally {
                setSaving(false);
        }
  };

  const handleCancel = () => {
        stopCamera();
        setCapturedImage(null);
  };

  // Hidden file input for mobile/HTTP fallback
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
                                                          </div>div>
                                                          Validação Facial
                                            </CardTitle>CardTitle>
                                            <CardDescription>
                                                          Capture ou envie uma selfie para verificação de identidade.
                                            </CardDescription>CardDescription>
                                </div>div>
                                <Badge variant="outline" className={statusMeta.tone}>
                                            <StatusIcon className="w-3.5 h-3.5 mr-1" />
                                  {statusMeta.label}
                                </Badge>Badge>
                      </div>div>
                      <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{statusMeta.description}</AlertDescription>AlertDescription>
                      </Alert>Alert>
              </CardHeader>CardHeader>
        
              <CardContent className="pt-6 space-y-4">
                {renderFileInput()}
              
                {(currentFaceUrl || validation?.provider || validation?.requestedAt) && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                                <div className="grid gap-2 sm:grid-cols-2">
                                              <div>
                                                              <p className="text-muted-foreground">Provedor</p>p>
                                                              <p className="font-medium">{validation?.provider || "Aguardando envio"}</p>p>
                                              </div>div>
                                              <div>
                                                              <p className="text-muted-foreground">Solicitado em</p>p>
                                                              <p className="font-medium">{formatDateTime(validation?.requestedAt) || "-"}</p>p>
                                              </div>div>
                                              <div>
                                                              <p className="text-muted-foreground">Validado em</p>p>
                                                              <p className="font-medium">{formatDateTime(validation?.validatedAt) || "-"}</p>p>
                                              </div>div>
                                              <div>
                                                              <p className="text-muted-foreground">Protocolo</p>p>
                                                              <p className="font-medium break-all">{validation?.referenceId || "-"}</p>p>
                                              </div>div>
                                </div>div>
                      {scorePercent != null && (
                                    <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-sm">
                                                                      <span className="text-muted-foreground">Score de correspondência</span>span>
                                                                      <span className="font-semibold">{scorePercent}%</span>span>
                                                    </div>div>
                                                    <Progress value={scorePercent} className="h-2" />
                                    </div>div>
                                )}
                    </div>div>
                      )}
              
                {/* Already has photo */}
                {currentFaceUrl && !capturing && !capturedImage ? (
                    <div className="space-y-4">
                                <div className="border-2 border-border rounded-lg p-4 bg-white flex justify-center">
                                              <img src={currentFaceUrl} alt="Selfie de validação facial" className="max-h-48 rounded-lg object-cover" />
                                </div>div>
                                <div className="flex flex-wrap items-center gap-2 justify-center text-sm text-muted-foreground">
                                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                              Selfie cadastrada para validação de identidade
                                </div>div>
                                <div className="flex gap-2">
                                  {isCameraAvailable() ? (
                                      <Button type="button" variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                                                        <RefreshCw className="w-4 h-4" /> Refazer com câmera
                                      </Button>Button>
                                    ) : null}
                                              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => fileInputRef.current?.click()}>
                                                              <Upload className="w-4 h-4" /> Enviar arquivo
                                              </Button>Button>
                                              <Button type="button" variant="destructive" size="icon" onClick={handleDelete} disabled={saving}>
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                              </Button>Button>
                                </div>div>
                    </div>div>
          
                  ) : capturing ? (
                    /* Camera view */
                    <div className="space-y-4">
                                <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-black">
                                              <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                                </div>div>
                                <div className="text-xs text-muted-foreground text-center space-y-1">
                                              <p>Centralize o rosto, retire óculos escuros e use boa iluminação.</p>p>
                                </div>div>
                                <div className="flex gap-2">
                                              <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>Cancelar</Button>Button>
                                              <Button type="button" className="flex-1 gap-2" onClick={capturePhoto}>
                                                              <Camera className="w-4 h-4" /> Capturar selfie
                                              </Button>Button>
                                </div>div>
                    </div>div>
          
                  ) : capturedImage ? (
                    /* Preview captured/selected image */
                    <div className="space-y-4">
                                <div className="border-2 border-primary/30 rounded-lg overflow-hidden bg-white flex justify-center">
                                              <img src={capturedImage} alt="Selfie capturada" className="max-h-48 rounded object-cover" />
                                </div>div>
                                <Alert>
                                              <AlertCircle className="h-4 w-4" />
                                              <AlertDescription>
                                                              Ao confirmar, a selfie ficará com status <strong>Em análise</strong>strong> até o retorno da validação.
                                              </AlertDescription>AlertDescription>
                                </Alert>Alert>
                                <div className="flex gap-2">
                                              <Button type="button" variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); }}>
                                                              Cancelar
                                              </Button>Button>
                                              <Button type="button" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                              Enviar para validação
                                              </Button>Button>
                                </div>div>
                    </div>div>
          
                  ) : (
                    /* Initial state - no photo yet */
                    <div className="space-y-3">
                                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                                              <ScanFace className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                              <p className="text-muted-foreground text-sm">Nenhuma selfie enviada para validação facial</p>p>
                                  {!isCameraAvailable() && (
                                      <p className="text-xs text-amber-600 mt-2">
                                                        📷 Câmera indisponível neste ambiente (HTTP). Use o upload de arquivo abaixo.
                                      </p>p>
                                              )}
                                </div>div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  {isCameraAvailable() && (
                                      <Button type="button" variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                                                        <Camera className="w-4 h-4" /> Usar câmera
                                      </Button>Button>
                                              )}
                                              <Button
                                                                type="button"
                                                                variant={isCameraAvailable() ? "outline" : "default"}
                                                                className="flex-1 gap-2"
                                                                onClick={() => fileInputRef.current?.click()}
                                                              >
                                                              <Upload className="w-4 h-4" />
                                                {isCameraAvailable() ? "Enviar arquivo" : "Selecionar foto"}
                                              </Button>Button>
                                </div>div>
                    </div>div>
                      )}
              </CardContent>CardContent>
        </Card>Card>
      );
}</Card>
