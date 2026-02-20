import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadField } from "@/components/profile/FileUploadField";
import { useDriverLicense } from "@/contexts/DriverLicenseContext";
import { submitDriverLicense, getSignedImageUrl } from "@/lib/driverLicenseService";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const CNH_CATEGORIES = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];
const VERIFICATION_TIMEOUT_MS = 90_000; // 90 seconds

export default function DriverLicenseForm() {
  const navigate = useNavigate();
  const { licenseStatus, licenseData, loadFromSupabase, isLoading: contextLoading } = useDriverLicense();

  // Form state
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [category, setCategory] = useState("");
  const [cpf, setCpf] = useState("");
  const [codigoSeguranca, setCodigoSeguranca] = useState("");
  const [nomeMae, setNomeMae] = useState("");

  // Files state
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [verificationResult, setVerificationResult] = useState<{
    approved: boolean;
    statusLabel: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carregar dados existentes do Supabase
  useEffect(() => {
    const loadExistingData = async () => {
      await loadFromSupabase();
      setInitialLoading(false);
    };
    loadExistingData();
  }, []);

  // Preencher formulário com dados existentes
  useEffect(() => {
    if (licenseData) {
      setFullName(licenseData.fullName || "");
      setLicenseNumber(licenseData.licenseNumber || "");
      setCategory(licenseData.category || "");

      const loadPreviews = async () => {
        if (licenseData.frontPath) {
          const url = await getSignedImageUrl(licenseData.frontPath);
          if (url) setFrontPreview(url);
        }
        if (licenseData.backPath) {
          const url = await getSignedImageUrl(licenseData.backPath);
          if (url) setBackPreview(url);
        }
        if (licenseData.selfiePath) {
          const url = await getSignedImageUrl(licenseData.selfiePath);
          if (url) setSelfiePreview(url);
        }
      };
      loadPreviews();
    }
  }, [licenseData]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = "Nome completo é obrigatório";
    if (!licenseNumber.trim()) newErrors.licenseNumber = "Número da CNH é obrigatório";
    if (!category) newErrors.category = "Categoria é obrigatória";
    if (!cpf.trim()) newErrors.cpf = "CPF é obrigatório";
    if (!codigoSeguranca.trim()) newErrors.codigoSeguranca = "Código de segurança é obrigatório";
    if (!nomeMae.trim()) newErrors.nomeMae = "Nome da mãe é obrigatório";

    const hasExistingFront = licenseData?.frontPath;
    const hasExistingBack = licenseData?.backPath;
    const hasExistingSelfie = licenseData?.selfiePath;

    if (!frontFile && !hasExistingFront) newErrors.front = "Foto da frente é obrigatória";
    if (!backFile && !hasExistingBack) newErrors.back = "Foto do verso é obrigatória";
    if (!selfieFile && !hasExistingSelfie) newErrors.selfie = "Selfie segurando a CNH é obrigatória";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    setVerificationResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      // 1. Salvar dados e fotos no Supabase
      const result = await submitDriverLicense(
        user.id,
        { fullName, licenseNumber, category, expiresAt: "" },
        { front: frontFile, back: backFile, selfie: selfieFile }
      );

      if (!result.success) {
        toast.error(result.error || "Erro ao enviar CNH");
        setLoading(false);
        return;
      }

      // 2. Obter URLs assinadas das imagens
      const getFrontPath = frontFile
        ? `${user.id}/front.${frontFile.name.split(".").pop()?.toLowerCase() || "jpg"}`
        : licenseData?.frontPath;
      const getBackPath = backFile
        ? `${user.id}/back.${backFile.name.split(".").pop()?.toLowerCase() || "jpg"}`
        : licenseData?.backPath;
      const getSelfiePath = selfieFile
        ? `${user.id}/selfie.${selfieFile.name.split(".").pop()?.toLowerCase() || "jpg"}`
        : licenseData?.selfiePath;

      const frontUrl = getFrontPath ? await getSignedImageUrl(getFrontPath) : null;
      const backUrl = getBackPath ? await getSignedImageUrl(getBackPath) : null;
      const selfieUrl = getSelfiePath ? await getSignedImageUrl(getSelfiePath) : null;

      // 3. Iniciar verificação - mostrar timer
      setLoading(false);
      setVerifying(true);
      startTimer();

      // 4. Chamar webhook n8n com timeout de 90s
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

      let webhookResult: { cnh_aprovada?: boolean; status?: string } | null = null;

      try {
        console.log("[CNH] Enviando para webhook...");
        const webhookResponse = await fetch(
          "https://n8n.srv1153225.hstgr.cloud/webhook/cnhcheck",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              user_id: user.id,
              full_name: fullName,
              license_number: licenseNumber,
              category,
              cpf,
              codigo_seguranca: codigoSeguranca,
              nome_mae: nomeMae,
              front_image_url: frontUrl,
              back_image_url: backUrl,
              selfie_image_url: selfieUrl,
            }),
          }
        );

        clearTimeout(timeoutId);

        if (webhookResponse.ok) {
          const rawText = await webhookResponse.text();
          console.log("[CNH] Resposta bruta do webhook:", rawText);
          
          try {
            const parsed = JSON.parse(rawText);
            // Handle both array and object responses from n8n
            webhookResult = Array.isArray(parsed) ? parsed[0] : parsed;
            console.log("[CNH] Resultado parseado:", webhookResult);
          } catch (parseErr) {
            console.error("[CNH] Erro ao parsear resposta:", parseErr);
          }
        } else {
          console.error("[CNH] Webhook retornou status:", webhookResponse.status);
        }
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          console.error("[CNH] Webhook timeout após", VERIFICATION_TIMEOUT_MS / 1000, "segundos");
        } else {
          console.error("[CNH] Erro no webhook:", fetchErr);
        }
      }

      stopTimer();

      // 5. Processar resultado do webhook
      if (webhookResult && typeof webhookResult.cnh_aprovada === "boolean") {
        const isApproved = webhookResult.cnh_aprovada;
        const newStatus = isApproved ? "approved" : "rejected";
        const statusLabel = webhookResult.status || (isApproved ? "APROVADA" : "REPROVADA");

        console.log("[CNH] Atualizando status no banco:", newStatus);

        // 5a. Atualizar oli_driver_licenses
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("oli_driver_licenses")
          .update({
            status: newStatus,
            ...(isApproved ? { verified_at: new Date().toISOString() } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (updateError) {
          console.error("[CNH] Erro ao atualizar status:", updateError);
          toast.error("Erro ao atualizar status da CNH no banco");
        } else {
          console.log("[CNH] Status atualizado com sucesso:", newStatus);
        }

        // 5b. Mostrar resultado na tela
        setVerificationResult({ approved: isApproved, statusLabel });

        // 5c. Enviar email de notificação
        try {
          const EDGE_FUNCTION_URL = `https://sgpktbljjlixmyjmhppa.supabase.co/functions/v1/send-notification-email`;
          const { data: { session } } = await supabase.auth.getSession();
          
          const emailPayload = {
            type: isApproved ? "cnh_approved" : "cnh_rejected",
            recipient_id: user.id,
            data: {
              full_name: fullName,
              status_label: statusLabel,
            },
          };
          console.log("[CNH] Enviando email:", emailPayload);

          const emailResp = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGt0YmxqamxpeG15am1ocHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTE5MjksImV4cCI6MjA4NDQ4NzkyOX0.OoTf_1N0KWWGSfnk-6ZE-M2yg5z8wmej6E83bdWKUAU",
            },
            body: JSON.stringify(emailPayload),
          });

          const emailResult = await emailResp.text();
          console.log("[CNH] Resposta do email:", emailResp.status, emailResult);
        } catch (emailErr) {
          console.warn("[CNH] Email de notificação falhou:", emailErr);
        }

        // 5d. Recarregar dados do contexto
        await loadFromSupabase();
      } else {
        // Webhook não retornou resultado válido
        setVerifying(false);
        toast.info("Verificação em andamento. Você será notificado em breve.");
        await loadFromSupabase();
        navigate("/profile/driver-license");
        return;
      }

      setVerifying(false);
    } catch (err) {
      console.error("[CNH] Erro geral:", err);
      toast.error("Erro inesperado ao enviar CNH");
      stopTimer();
      setVerifying(false);
      setLoading(false);
    }
  };

  const isViewMode = licenseStatus === "approved";

  if (initialLoading || contextLoading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WebLayout>
    );
  }

  // Tela de resultado da verificação
  if (verificationResult) {
    return (
      <WebLayout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          {verificationResult.approved ? (
            <>
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-green-800 mb-2">CNH Aprovada!</h1>
              <p className="text-muted-foreground mb-2">
                Status: <span className="font-semibold text-green-700">{verificationResult.statusLabel}</span>
              </p>
              <p className="text-muted-foreground mb-8">
                Sua carteira de habilitação foi verificada com sucesso. Agora você pode fazer reservas de veículos na plataforma.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate("/search")} className="w-full h-12">
                  Buscar veículos
                </Button>
                <Button variant="outline" onClick={() => navigate("/profile")} className="w-full h-12">
                  Voltar ao perfil
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-red-800 mb-2">CNH Reprovada</h1>
              <p className="text-muted-foreground mb-2">
                Status: <span className="font-semibold text-red-700">{verificationResult.statusLabel}</span>
              </p>
              <p className="text-muted-foreground mb-8">
                Sua carteira de habilitação não foi aprovada. Verifique os dados informados e as fotos enviadas, depois tente novamente.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => { setVerificationResult(null); }} className="w-full h-12">
                  Corrigir e reenviar
                </Button>
                <Button variant="outline" onClick={() => navigate("/profile")} className="w-full h-12">
                  Voltar ao perfil
                </Button>
              </div>
            </>
          )}
        </div>
      </WebLayout>
    );
  }

  // Tela de verificação em andamento (timer)
  if (verifying) {
    const progressPercent = Math.min((elapsedSeconds / 60) * 100, 95);
    return (
      <WebLayout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Verificando sua CNH</h1>
          <p className="text-muted-foreground mb-6">
            Estamos consultando os órgãos de trânsito para validar sua habilitação. 
            Isso pode levar até 60 segundos.
          </p>

          <div className="mb-4">
            <Progress value={progressPercent} className="h-3" />
          </div>

          <div className="flex items-center justify-center gap-2 text-lg font-mono text-muted-foreground">
            <span>{String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}</span>
            <span>:</span>
            <span>{String(elapsedSeconds % 60).padStart(2, "0")}</span>
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            Não feche esta página. O resultado aparecerá automaticamente.
          </p>
        </div>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Verificação de CNH</h1>
          </div>
          <p className="text-muted-foreground">
            {isViewMode
              ? "Seus dados de CNH verificados"
              : "Envie sua CNH para liberar reservas e aluguel."}
          </p>
        </div>

        {/* Status Banner */}
        {licenseStatus === "pending" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⏳</span>
            </div>
            <div>
              <p className="font-medium text-yellow-800">Em análise</p>
              <p className="text-sm text-yellow-700">Sua CNH está sendo analisada.</p>
            </div>
          </div>
        )}

        {licenseStatus === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">❌</span>
            </div>
            <div>
              <p className="font-medium text-red-800">CNH rejeitada</p>
              <p className="text-sm text-red-700">Corrija os dados e reenvie.</p>
            </div>
          </div>
        )}

        {licenseStatus === "approved" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <p className="font-medium text-green-800">CNH aprovada</p>
              <p className="text-sm text-green-700">Você pode fazer reservas.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Dados da CNH</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nome completo <span className="text-destructive">*</span></Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como consta na CNH"
                  className={`mt-1 h-12 ${errors.fullName ? "border-destructive" : ""}`}
                  disabled={isViewMode}
                />
                {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName}</p>}
              </div>

              <div>
                <Label htmlFor="licenseNumber">Número da CNH <span className="text-destructive">*</span></Label>
                <Input
                  id="licenseNumber"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="00000000000"
                  className={`mt-1 h-12 ${errors.licenseNumber ? "border-destructive" : ""}`}
                  disabled={isViewMode}
                />
                {errors.licenseNumber && <p className="text-sm text-destructive mt-1">{errors.licenseNumber}</p>}
              </div>

              <div>
                <Label htmlFor="category">Categoria <span className="text-destructive">*</span></Label>
                <Select value={category} onValueChange={setCategory} disabled={isViewMode}>
                  <SelectTrigger className={`mt-1 h-12 ${errors.category ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CNH_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>Categoria {cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-sm text-destructive mt-1">{errors.category}</p>}
              </div>

              {/* Additional Fields */}
              <div className="space-y-4 pt-2">
                <h3 className="font-medium text-base text-muted-foreground">Dados adicionais</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cpf">CPF <span className="text-destructive">*</span></Label>
                    <Input
                      id="cpf"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className={`mt-1 h-12 ${errors.cpf ? "border-destructive" : ""}`}
                      disabled={isViewMode}
                    />
                    {errors.cpf && <p className="text-sm text-destructive mt-1">{errors.cpf}</p>}
                  </div>
                  <div>
                    <Label htmlFor="codigoSeguranca">Código de Segurança <span className="text-destructive">*</span></Label>
                    <Input
                      id="codigoSeguranca"
                      value={codigoSeguranca}
                      onChange={(e) => setCodigoSeguranca(e.target.value)}
                      placeholder="Código de segurança da CNH"
                      className={`mt-1 h-12 ${errors.codigoSeguranca ? "border-destructive" : ""}`}
                      disabled={isViewMode}
                    />
                    {errors.codigoSeguranca && <p className="text-sm text-destructive mt-1">{errors.codigoSeguranca}</p>}
                  </div>
                </div>
                <div>
                  <Label htmlFor="nomeMae">Nome da Mãe <span className="text-destructive">*</span></Label>
                  <Input
                    id="nomeMae"
                    value={nomeMae}
                    onChange={(e) => setNomeMae(e.target.value)}
                    placeholder="Nome completo da mãe"
                    className={`mt-1 h-12 ${errors.nomeMae ? "border-destructive" : ""}`}
                    disabled={isViewMode}
                  />
                  {errors.nomeMae && <p className="text-sm text-destructive mt-1">{errors.nomeMae}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Document Photos */}
          {!isViewMode && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-lg">Fotos do documento</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <FileUploadField
                  label="Foto da frente"
                  required
                  file={frontFile}
                  preview={frontPreview}
                  onFileSelect={(file, preview) => { setFrontFile(file); setFrontPreview(preview); }}
                  error={errors.front}
                />
                <FileUploadField
                  label="Foto do verso"
                  required
                  file={backFile}
                  preview={backPreview}
                  onFileSelect={(file, preview) => { setBackFile(file); setBackPreview(preview); }}
                  error={errors.back}
                />
              </div>
              <FileUploadField
                label="Selfie segurando CNH"
                required
                file={selfieFile}
                preview={selfiePreview}
                onFileSelect={(file, preview) => { setSelfieFile(file); setSelfiePreview(preview); }}
                error={errors.selfie}
              />
            </div>
          )}

          {/* View mode - show existing photos */}
          {isViewMode && (frontPreview || backPreview || selfiePreview) && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-lg">Fotos do documento</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {frontPreview && (
                  <div>
                    <Label className="mb-2 block">Frente</Label>
                    <img src={frontPreview} alt="Frente CNH" className="rounded-lg w-full h-40 object-cover" />
                  </div>
                )}
                {backPreview && (
                  <div>
                    <Label className="mb-2 block">Verso</Label>
                    <img src={backPreview} alt="Verso CNH" className="rounded-lg w-full h-40 object-cover" />
                  </div>
                )}
              </div>
              {selfiePreview && (
                <div>
                  <Label className="mb-2 block">Selfie</Label>
                  <img src={selfiePreview} alt="Selfie CNH" className="rounded-lg w-full max-w-xs h-40 object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          {!isViewMode && (
            <Button type="submit" disabled={loading} className="w-full h-14 text-lg" size="lg">
              {loading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</>
              ) : licenseStatus === "rejected" ? (
                "Reenviar para verificação"
              ) : licenseStatus === "pending" ? (
                "Atualizar e reenviar"
              ) : (
                "Enviar para verificação"
              )}
            </Button>
          )}
        </form>
      </div>
    </WebLayout>
  );
}
