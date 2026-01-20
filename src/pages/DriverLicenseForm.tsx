import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadField } from "@/components/profile/FileUploadField";
import { useDriverLicense, LicenseData, LicenseFiles } from "@/contexts/DriverLicenseContext";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const CNH_CATEGORIES = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];

export default function DriverLicenseForm() {
  const navigate = useNavigate();
  const { licenseStatus, licenseData, submitLicense } = useDriverLicense();

  // Form state
  const [fullName, setFullName] = useState(licenseData.fullName);
  const [licenseNumber, setLicenseNumber] = useState(licenseData.licenseNumber);
  const [category, setCategory] = useState(licenseData.category);
  const [expiresAt, setExpiresAt] = useState(licenseData.expiresAt);

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
    if (!frontFile) {
      newErrors.front = "Foto da frente é obrigatória";
    }
    if (!backFile) {
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

    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const data: LicenseData = {
      fullName,
      licenseNumber,
      category,
      expiresAt,
    };

    const files: LicenseFiles = {
      front: frontFile,
      back: backFile,
      selfie: selfieFile,
      frontPreview,
      backPreview,
      selfiePreview,
    };

    submitLicense(data, files);
    setLoading(false);
    toast.success("CNH enviada para verificação!");
    navigate("/profile");
  };

  const isViewMode = licenseStatus === "approved";

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
                  <Label htmlFor="expiresAt">
                    Validade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className={`mt-1 h-12 ${errors.expiresAt ? "border-destructive" : ""}`}
                    disabled={isViewMode}
                  />
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

          {/* Submit Button */}
          {!isViewMode && (
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {loading
                ? "Enviando..."
                : licenseStatus === "rejected"
                ? "Reenviar para verificação"
                : "Enviar para verificação"}
            </Button>
          )}
        </form>
      </div>
    </WebLayout>
  );
}
