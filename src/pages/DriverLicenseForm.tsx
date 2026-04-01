import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useDriverLicense } from "@/contexts/DriverLicenseContext";
import { getDriverLicense, submitDriverLicense, getSignedImageUrl } from "@/lib/driverLicenseService";
import { getVehicleById } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2, XCircle, Info } from "lucide-react";
import { toast } from "sonner";

const CNH_CATEGORIES = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];
const VERIFICATION_TIMEOUT_MS = 90_000; // 90 seconds

type VerificationFlow = "profile" | "rental";
type FlowLicenseStatus = "not_sent" | "pending" | "approved" | "rejected";

interface RentalVerificationContext {
  id: string;
  renter_id: string;
  status: string;
  driver_license_id: string | null;
  driver_license_verification_status: string | null;
  driver_license_verified_at: string | null;
  vehicleTitle: string;
}

function mapRentalLicenseStatus(status: string | null | undefined): FlowLicenseStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "pending") return "pending";
  return "not_sent";
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function SecurityCodeHint() {
  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Onde localizar o codigo de seguranca da CNH"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-medium">Onde encontrar o codigo de seguranca</p>
          <p className="text-sm text-muted-foreground">
            Na CNH fisica, ele aparece como um numero pequeno na faixa inferior do documento.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="h-2 w-24 rounded-full bg-slate-300" />
                <div className="mt-2 h-2 w-32 rounded-full bg-slate-200" />
                <div className="mt-2 h-2 w-20 rounded-full bg-slate-200" />
              </div>
              <div className="h-14 w-12 rounded-lg bg-slate-200" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-2 rounded-full bg-slate-200" />
              <div className="h-2 rounded-full bg-slate-200" />
              <div className="h-2 rounded-full bg-slate-200" />
              <div className="h-2 rounded-full bg-slate-200" />
            </div>
            <div className="mt-5 rounded-lg border border-dashed border-primary bg-primary/10 p-3 text-center">
              <p className="text-xs font-semibold text-primary">Codigo de seguranca</p>
              <p className="text-[11px] text-muted-foreground">Faixa inferior da CNH</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Ilustracao simplificada apenas para orientar o local do campo no documento.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
export default function DriverLicenseForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verificationFlow: VerificationFlow = searchParams.get("flow") === "rental" ? "rental" : "profile";
  const rentalId = searchParams.get("rentalId");
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
  const [warningOpen, setWarningOpen] = useState(false);
  const [submitConfirmed, setSubmitConfirmed] = useState(false);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [verificationResult, setVerificationResult] = useState<{
    approved: boolean;
    statusLabel: string;
    motivo?: string | null;
    camposReprovados?: string[];
    camposAusentes?: string[];
  } | null>(null);
  const [rentalContext, setRentalContext] = useState<RentalVerificationContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carregar dados existentes do Supabase
  useEffect(() => {
    const loadExistingData = async () => {
      await loadFromSupabase();
      if (verificationFlow === "rental") {
        await loadRentalContext();
      }
      setInitialLoading(false);
    };

    void loadExistingData();
  }, [verificationFlow, rentalId]);

  // Preencher formulario com dados existentes
  useEffect(() => {
    if (licenseData) {
      setFullName(licenseData.fullName || "");
      setLicenseNumber(licenseData.licenseNumber || "");
      setCategory(licenseData.category || "");
      setCpf(licenseData.cpf ? formatCPF(licenseData.cpf) : "");
      setCodigoSeguranca(licenseData.codigoSeguranca || "");
      setNomeMae(licenseData.nomeMae || "");

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

      void loadPreviews();
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

  const loadRentalContext = async () => {
    if (!rentalId) {
      toast.error("Reserva nao encontrada para esta validacao.");
      navigate("/reservations");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;

    if (!currentUser) {
      navigate("/auth");
      return;
    }

    const { data: rentalData, error } = await supabase
      .from("oli_rentals")
      .select("*")
      .eq("id", rentalId)
      .single();

    if (error || !rentalData) {
      toast.error("Nao foi possivel carregar a reserva para validar a CNH.");
      navigate("/reservations");
      return;
    }

    if (rentalData.renter_id !== currentUser.id) {
      toast.error("Essa validacao so pode ser feita pelo locatario da reserva.");
      navigate("/reservations");
      return;
    }

    const vehicle = await getVehicleById(rentalData.vehicle_id);
    const vehicleTitle = vehicle?.title || `${vehicle?.brand || ""} ${vehicle?.model || ""} ${vehicle?.year || ""}`.trim() || "Veiculo";

    setRentalContext({
      id: rentalData.id,
      renter_id: rentalData.renter_id,
      status: rentalData.status,
      driver_license_id: rentalData.driver_license_id,
      driver_license_verification_status: (rentalData as { driver_license_verification_status?: string | null }).driver_license_verification_status || null,
      driver_license_verified_at: (rentalData as { driver_license_verified_at?: string | null }).driver_license_verified_at || null,
      vehicleTitle,
    });
  };

  const updateRentalVerification = async (params: {
    driver_license_id?: string | null;
    status: string;
    verifiedAt?: string | null;
    payload?: Json | null;
  }) => {
    if (verificationFlow !== "rental" || !rentalContext) {
      return;
    }

    const { error } = await supabase
      .from("oli_rentals")
      .update({
        driver_license_id: params.driver_license_id ?? rentalContext.driver_license_id,
        driver_license_verification_status: params.status,
        driver_license_verified_at: params.verifiedAt ?? null,
        driver_license_verification_payload: params.payload ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rentalContext.id);

    if (error) {
      console.error("[CNH] Erro ao atualizar a reserva:", error);
      return;
    }

    setRentalContext((currentValue) => currentValue ? {
      ...currentValue,
      driver_license_id: params.driver_license_id ?? currentValue.driver_license_id,
      driver_license_verification_status: params.status,
      driver_license_verified_at: params.verifiedAt ?? null,
    } : currentValue);
  };

  const currentStatus: FlowLicenseStatus = verificationFlow === "rental"
    ? mapRentalLicenseStatus(rentalContext?.driver_license_verification_status)
    : licenseStatus;

  const pageBackTarget = verificationFlow === "rental" ? "/reservations" : "/profile";
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = "Nome completo e obrigatorio";
    if (!licenseNumber.trim()) newErrors.licenseNumber = "Numero de Registro da CNH e obrigatorio";
    if (!category) newErrors.category = "Categoria e obrigatoria";
    if (!cpf.trim()) newErrors.cpf = "CPF e obrigatorio";
    if (!codigoSeguranca.trim()) newErrors.codigoSeguranca = "Codigo de seguranca e obrigatorio";
    if (!nomeMae.trim()) newErrors.nomeMae = "Nome da mae e obrigatorio";

    const hasExistingFront = licenseData?.frontPath;
    const hasExistingBack = licenseData?.backPath;
    const hasExistingSelfie = licenseData?.selfiePath;

    if (!frontFile && !hasExistingFront) newErrors.front = "Foto da frente é obrigatória";
    if (!backFile && !hasExistingBack) newErrors.back = "Foto do verso é obrigatória";
    if (!selfieFile && !hasExistingSelfie) newErrors.selfie = "Selfie segurando a CNH é obrigatória";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const confirmWarningAndSubmit = () => {
    setWarningOpen(false);
    setSubmitConfirmed(true);
    const formElement = document.getElementById("driver-license-form") as HTMLFormElement | null;
    formElement?.requestSubmit();
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }

    if (!submitConfirmed) {
      setWarningOpen(true);
      return;
    }

    setSubmitConfirmed(false);
    setLoading(true);
    setVerificationResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vocàª precisa estar logado");
        navigate("/auth");
        return;
      }

      // 1. Salvar dados e fotos no Supabase
      const result = await submitDriverLicense(
        user.id,
        { fullName, licenseNumber, category, expiresAt: "", cpf, codigoSeguranca, nomeMae },
        { front: frontFile, back: backFile, selfie: selfieFile }
      );

      if (!result.success) {
        toast.error(result.error || "Erro ao enviar CNH");
        setLoading(false);
        return;
      }

      const latestLicense = await getDriverLicense(user.id);

      if (verificationFlow === "rental") {
        await updateRentalVerification({
          driver_license_id: latestLicense?.id ?? null,
          status: "pending",
        });
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
      let webhookResult: { 
        cnh_aprovada?: boolean; 
        status?: string; 
        motivo?: string | null;
        campos_reprovados?: string[];
        campos_ausentes?: string[];
      } | null = null;

      try {
        console.log("[CNH] Enviando para webhook via proxy...");
        
        const invokePromise = supabase.functions.invoke("webhook-proxy", {
          body: {
            _webhook_target: "cnhcheck",
            user_id: user.id,
            rental_id: verificationFlow === "rental" ? rentalContext?.id : null,
            verification_flow: verificationFlow,
            full_name: fullName,
            license_number: licenseNumber,
            category,
            cpf,
            codigo_seguranca: codigoSeguranca,
            nome_mae: nomeMae,
            front_image_url: frontUrl,
            back_image_url: backUrl,
            selfie_image_url: selfieUrl,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), VERIFICATION_TIMEOUT_MS)
        );

        const { data: webhookData, error: webhookError } = await Promise.race([
          invokePromise,
          timeoutPromise,
        ]) as Awaited<typeof invokePromise>;

        if (webhookError) {
          console.error("[CNH] Erro no webhook-proxy:", webhookError);
        } else if (webhookData) {
          console.log("[CNH] Resposta do webhook-proxy (raw):", webhookData);
          let parsed = typeof webhookData === "string" ? JSON.parse(webhookData) : webhookData;
          parsed = Array.isArray(parsed) ? parsed[0] : parsed;

          // n8n may nest response in { output: "..." }
          if (parsed?.output && typeof parsed.output === "string") {
            try {
              const inner = JSON.parse(parsed.output);
              parsed = Array.isArray(inner) ? inner[0] : inner;
            } catch {
              console.warn("[CNH] Falha ao parsear output interno:", parsed.output);
            }
          }

          console.log("[CNH] Parsed result:", parsed);

          // Map response: status "APROVADA" = approved, anything else = rejected
          const statusUpper = (parsed?.status || "").toUpperCase();
          const isApproved = statusUpper === "APROVADA";
          webhookResult = {
            cnh_aprovada: isApproved,
            status: parsed?.status || statusUpper,
            motivo: parsed?.motivo || null,
            campos_reprovados: parsed?.campos_reprovados || [],
            campos_ausentes: parsed?.campos_ausentes || [],
          };
          console.log("[CNH] Resultado final:", webhookResult);
        }
      } catch (fetchErr: unknown) {
        if (fetchErr instanceof Error && fetchErr.message === "TIMEOUT") {
          console.error("[CNH] Webhook timeout após", VERIFICATION_TIMEOUT_MS / 1000, "segundos");
        } else {
          console.error("[CNH] Erro no webhook:", fetchErr);
        }
      }

      stopTimer();

      // 5. Processar resultado - NUNCA deixar como pendente, sempre aprovado ou rejeitado
      const isApproved = webhookResult?.cnh_aprovada === true;
      const newStatus = isApproved ? "approved" : "rejected";
      const statusLabel = webhookResult?.status || (isApproved ? "APROVADA" : "REPROVADA");
      const motivo = webhookResult?.motivo || (isApproved ? null : "Falha na verificação ou timeout");
      const camposReprovados = webhookResult?.campos_reprovados || [];
      const camposAusentes = webhookResult?.campos_ausentes || [];

      // Build rejection notes for DB
      const rejectionNotes = !isApproved
        ? [
            motivo ? `Motivo: ${motivo}` : null,
            camposReprovados.length > 0 ? `Campos reprovados: ${camposReprovados.join(", ")}` : null,
            camposAusentes.length > 0 ? `Campos ausentes: ${camposAusentes.join(", ")}` : null,
          ].filter(Boolean).join(". ")
        : null;

      console.log("[CNH] Atualizando status no banco:", newStatus);

      // 5a. Atualizar oli_driver_licenses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("oli_driver_licenses")
        .update({
          status: newStatus,
          notes: rejectionNotes,
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

      await updateRentalVerification({
        driver_license_id: latestLicense?.id ?? null,
        status: newStatus,
        verifiedAt: isApproved ? new Date().toISOString() : null,
        payload: webhookResult as Json,
      });

      // 5b. Mostrar resultado na tela
      setVerificationResult({ 
        approved: isApproved, 
        statusLabel, 
        motivo,
        camposReprovados,
        camposAusentes,
      });

      // 5c. Enviar email
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

        await fetch(EDGE_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": session?.access_token ? `Bearer ${session.access_token}` : "",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGt0YmxqamxpeG15am1ocHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTE5MjksImV4cCI6MjA4NDQ4NzkyOX0.OoTf_1N0KWWGSfnk-6ZE-M2yg5z8wmej6E83bdWKUAU",
          },
          body: JSON.stringify(emailPayload),
        });
      } catch (emailErr) {
        console.warn("[CNH] Email de notificação falhou:", emailErr);
      }

      // 5d. Recarregar dados do contexto
      await loadFromSupabase();

      setVerifying(false);
    } catch (err) {
      console.error("[CNH] Erro geral:", err);
      toast.error("Erro inesperado ao enviar CNH");
      stopTimer();
      setVerifying(false);
      setLoading(false);
    }
  };

  const isViewMode = currentStatus === "approved";

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
                Sua carteira de habilitação foi verificada com sucesso. Agora vocàª pode fazer reservas de veículos na plataforma.
              </p>
              <div className="flex flex-col gap-3">
                {verificationFlow === "rental" ? (
                  <Button onClick={() => navigate("/reservations")} className="w-full h-12">
                    Voltar para reservas
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => navigate("/search")} className="w-full h-12">
                      Buscar veiculos
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/profile")} className="w-full h-12">
                      Voltar ao perfil
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-destructive mb-2">CNH Reprovada</h1>
              {verificationResult.motivo && (
                <p className="text-destructive/80 mb-2">
                  Motivo: <span className="font-semibold">{verificationResult.motivo.replace(/_/g, " ")}</span>
                </p>
              )}
              {verificationResult.camposReprovados && verificationResult.camposReprovados.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-3 text-left">
                  <p className="text-sm font-medium text-destructive mb-1">Campos reprovados:</p>
                  <ul className="text-sm text-destructive/80 list-disc list-inside">
                    {verificationResult.camposReprovados.map((campo, i) => (
                      <li key={i}>{campo.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
              {verificationResult.camposAusentes && verificationResult.camposAusentes.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-3 text-left">
                  <p className="text-sm font-medium text-destructive mb-1">Campos ausentes:</p>
                  <ul className="text-sm text-destructive/80 list-disc list-inside">
                    {verificationResult.camposAusentes.map((campo, i) => (
                      <li key={i}>{campo.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-muted-foreground mb-8">
                Sua carteira de habilitação não foi aprovada na verificação. Verifique os dados informados e as fotos enviadas, ou entre em contato com o suporte.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => { setVerificationResult(null); }} className="w-full h-12">
                  Corrigir e reenviar
                </Button>
                <Button variant="outline" onClick={() => navigate(pageBackTarget)} className="w-full h-12">
                  Voltar
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
          onClick={() => navigate(pageBackTarget)}
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
            <div>
              <h1 className="text-2xl font-bold">{verificationFlow === "rental" ? "Validacao de CNH da reserva" : "Verificacao de CNH"}</h1>
              {verificationFlow === "rental" && rentalContext ? <p className="text-sm text-muted-foreground mt-1">Reserva: {rentalContext.vehicleTitle}</p> : null}
            </div>
          </div>
          <p className="text-muted-foreground">
            {verificationFlow === "rental"
              ? "Reutilize ou atualize sua CNH para liberar esta reserva apos a aprovacao do locador."
              : isViewMode
                ? "Seus dados de CNH verificados"
                : "Envie sua CNH para liberar reservas e aluguel."}
          </p>
        </div>

        {/* Status Banner */}
        {currentStatus === "pending" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">â³</span>
            </div>
            <div>
              <p className="font-medium text-yellow-800">Em análise</p>
              <p className="text-sm text-yellow-700">{verificationFlow === "rental" ? "A validacao desta reserva esta sendo analisada." : "Sua CNH esta sendo analisada."}</p>
            </div>
          </div>
        )}

        {currentStatus === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">âŒ</span>
            </div>
            <div>
              <p className="font-medium text-red-800">CNH rejeitada</p>
              <p className="text-sm text-red-700">Corrija os dados e reenvie.</p>
            </div>
          </div>
        )}

        {currentStatus === "approved" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">âœ…</span>
            </div>
            <div>
              <p className="font-medium text-green-800">{verificationFlow === "rental" ? "CNH validada para esta reserva" : "CNH aprovada"}</p>
              <p className="text-sm text-green-700">{verificationFlow === "rental" ? "A reserva pode seguir para as proximas etapas." : "Voce pode fazer reservas."}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form id="driver-license-form" onSubmit={handleSubmit} className="space-y-6">
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
                <Label htmlFor="licenseNumber">Numero de Registro da CNH <span className="text-destructive">*</span></Label>
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
                      onChange={(e) => setCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className={`mt-1 h-12 ${errors.cpf ? "border-destructive" : ""}`}
                      disabled={isViewMode}
                    />
                    {errors.cpf && <p className="text-sm text-destructive mt-1">{errors.cpf}</p>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="codigoSeguranca">Codigo de Seguranca <span className="text-destructive">*</span></Label>
                      <SecurityCodeHint />
                    </div>
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
              ) : verificationFlow === "rental" ? (
                currentStatus === "rejected" ? "Reenviar validacao da reserva" : "Validar CNH para esta reserva"
              ) : currentStatus === "rejected" ? (
                "Reenviar para verificação"
              ) : currentStatus === "pending" ? (
                "Atualizar e reenviar"
              ) : (
                "Enviar para verificação"
              )}
            </Button>
          )}
        <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Antes de enviar para validacao</AlertDialogTitle>
              <AlertDialogDescription>
                Se a CNH estiver com pendencias, vencimento, bloqueio ou qualquer situacao irregular, ela nao sera aceita pela plataforma. Confira o documento antes de continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Revisar dados</AlertDialogCancel>
              <AlertDialogAction onClick={confirmWarningAndSubmit}>Continuar com a validacao</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </form>
      </div>
    </WebLayout>
  );
}

























