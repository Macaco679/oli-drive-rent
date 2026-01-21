import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadField } from "@/components/profile/FileUploadField";
import { useDriverLicense, LicenseData, LicenseFiles } from "@/contexts/DriverLicenseContext";
import { submitDriverLicense, getSignedImageUrl } from "@/lib/driverLicenseService";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CNH_CATEGORIES = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];

export default function DriverLicenseForm() {
  const navigate = useNavigate();
  const { licenseStatus, licenseData, loadFromSupabase, isLoading: contextLoading } = useDriverLicense();

  // Form state
  const [fullName, setFullName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [category, setCategory] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

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
      setExpiresAt(licenseData.expiresAt || "");

      // Carregar previews das imagens existentes
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Nome completo é obrigatório";
    }
    if (!licenseNumber.trim()) {
      newErrors.licenseNumber = "Número da CNH é obrigatório";
    }
    if (!category) {
      newErrors.category = "Categoria é obrigatória";
    }
    if (!expiresAt) {
      newErrors.expiresAt = "Validade é obrigatória";
    }

    // Para novo envio, exigir fotos. Para reenvio, já pode ter paths salvos
    const hasExistingFront = licenseData.frontPath;
    const hasExistingBack = licenseData.backPath;

    if (!frontFile && !hasExistingFront) {
      newErrors.front = "Foto da frente é obrigatória";
    }
    if (!backFile && !hasExistingBack) {
      newErrors.back = "Foto do verso é obrigatória";
    }

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

    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      // Submeter para o Supabase
      const result = await submitDriverLicense(
        user.id,
        {
          fullName,
          licenseNumber,
          category,
          expiresAt,
        },
        {
          front: frontFile,
          back: backFile,
          selfie: selfieFile,
        }
      );

      if (!result.success) {
        toast.error(result.error || "Erro ao enviar CNH");
        setLoading(false);
        return;
      }

      // Recarregar dados do contexto
      await loadFromSupabase();

      toast.success("CNH enviada para verificação!");
      navigate("/profile");
    } catch (err) {
      console.error("[DriverLicenseForm] Erro:", err);
      toast.error("Erro inesperado ao enviar CNH");
    }

    setLoading(false);
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
              <p className="text-sm text-yellow-700">
                Sua CNH está sendo analisada. Você será notificado em breve.
              </p>
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
              <p className="text-sm text-red-700">
                Corrija os dados e reenvie para nova verificação.
              </p>
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
              <p className="text-sm text-green-700">
                Sua CNH foi verificada. Você pode fazer reservas.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Data */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Dados da CNH</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">
                  Nome completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Como consta na CNH"
                  className={`mt-1 h-12 ${errors.fullName ? "border-destructive" : ""}`}
                  disabled={isViewMode}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="licenseNumber">
                  Número da CNH <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="licenseNumber"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="00000000000"
                  className={`mt-1 h-12 ${errors.licenseNumber ? "border-destructive" : ""}`}
                  disabled={isViewMode}
                />
                {errors.licenseNumber && (
                  <p className="text-sm text-destructive mt-1">{errors.licenseNumber}</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">
                    Categoria <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={category}
                    onValueChange={setCategory}
                    disabled={isViewMode}
                  >
                    <SelectTrigger
                      className={`mt-1 h-12 ${errors.category ? "border-destructive" : ""}`}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CNH_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          Categoria {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-destructive mt-1">{errors.category}</p>
                  )}
                </div>

                <div>
                  <Label>
                    Validade <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild disabled={isViewMode}>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full mt-1 h-12 justify-start text-left font-normal",
                          !expiresAt && "text-muted-foreground",
                          errors.expiresAt && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiresAt ? (
                          format(new Date(expiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        ) : (
                          <span>Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card" align="start">
                      <Calendar
                        mode="single"
                        selected={expiresAt ? new Date(expiresAt) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setExpiresAt(format(date, "yyyy-MM-dd"));
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.expiresAt && (
                    <p className="text-sm text-destructive mt-1">{errors.expiresAt}</p>
                  )}
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
                  onFileSelect={(file, preview) => {
                    setFrontFile(file);
                    setFrontPreview(preview);
                  }}
                  error={errors.front}
                />

                <FileUploadField
                  label="Foto do verso"
                  required
                  file={backFile}
                  preview={backPreview}
                  onFileSelect={(file, preview) => {
                    setBackFile(file);
                    setBackPreview(preview);
                  }}
                  error={errors.back}
                />
              </div>

              <FileUploadField
                label="Selfie segurando CNH (opcional)"
                file={selfieFile}
                preview={selfiePreview}
                onFileSelect={(file, preview) => {
                  setSelfieFile(file);
                  setSelfiePreview(preview);
                }}
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
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Enviando...
                </>
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
