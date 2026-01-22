import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Camera, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronLeft,
  Car,
  Image as ImageIcon,
  Download,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getVehicleById, getProfileById, OliRental, OliVehicle, OliProfile } from "@/lib/supabase";
import {
  INSPECTION_PHOTO_TYPES,
  InspectionPhotoType,
  validateInspectionPhoto,
  uploadInspectionPhoto,
  createInspection,
  getInspectionByRental,
  Inspection,
  InspectionPhoto,
} from "@/lib/inspectionService";
import { generateInspectionPDF, generateComparisonPDF, InspectionReportData } from "@/lib/inspectionPdfService";
import { notifyDropoffInspectionCompleted, notifyPickupInspectionCompleted } from "@/lib/notificationService";

interface PhotoState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: boolean;
  url: string | null;
  hasDamage: boolean;
}

export default function VehicleInspection() {
  const { rentalId } = useParams<{ rentalId: string }>();
  const [searchParams] = useSearchParams();
  const inspectionKind = (searchParams.get("kind") as "pickup" | "dropoff") || "pickup";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [rental, setRental] = useState<OliRental | null>(null);
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [owner, setOwner] = useState<OliProfile | null>(null);
  const [renter, setRenter] = useState<OliProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [existingInspection, setExistingInspection] = useState<{
    inspection: Inspection;
    photos: InspectionPhoto[];
  } | null>(null);
  const [pickupInspection, setPickupInspection] = useState<{
    inspection: Inspection;
    photos: InspectionPhoto[];
  } | null>(null);

  // Photo states for each required photo
  const [photos, setPhotos] = useState<Record<string, PhotoState>>(() => {
    const initial: Record<string, PhotoState> = {};
    INSPECTION_PHOTO_TYPES.forEach((type) => {
      initial[type.id] = {
        file: null,
        preview: null,
        uploading: false,
        uploaded: false,
        url: null,
        hasDamage: false,
      };
    });
    return initial;
  });

  useEffect(() => {
    loadData();
  }, [rentalId, inspectionKind]);

  const loadData = async () => {
    if (!rentalId) {
      navigate("/reservations");
      return;
    }

    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);

    // Fetch rental
    const { data: rentalData, error: rentalError } = await supabase
      .from("oli_rentals")
      .select("*")
      .eq("id", rentalId)
      .single();

    if (rentalError || !rentalData) {
      toast.error("Reserva não encontrada");
      navigate("/reservations");
      return;
    }

    // For pickup: only owner can do it
    // For dropoff: renter does it (or owner)
    if (inspectionKind === "pickup" && rentalData.owner_id !== user.id) {
      toast.error("Apenas o proprietário pode realizar a vistoria de retirada");
      navigate("/reservations");
      return;
    }

    if (inspectionKind === "dropoff" && rentalData.renter_id !== user.id && rentalData.owner_id !== user.id) {
      toast.error("Apenas o locatário ou proprietário pode realizar a vistoria de devolução");
      navigate("/reservations");
      return;
    }

    // Check rental status - must be active (after payment)
    if (rentalData.status !== "active") {
      toast.error("A vistoria só pode ser realizada durante o período de locação");
      navigate("/reservations");
      return;
    }

    setRental(rentalData as OliRental);

    // Fetch vehicle and profiles
    const [vehicleData, ownerData, renterData] = await Promise.all([
      getVehicleById(rentalData.vehicle_id),
      getProfileById(rentalData.owner_id),
      getProfileById(rentalData.renter_id),
    ]);

    setVehicle(vehicleData);
    setOwner(ownerData);
    setRenter(renterData);

    // Check for existing inspection of this kind
    const existing = await getInspectionByRental(rentalId, inspectionKind);
    if (existing && existing.photos.length >= INSPECTION_PHOTO_TYPES.length) {
      setExistingInspection(existing);
    }

    // For dropoff, also load pickup inspection for comparison
    if (inspectionKind === "dropoff") {
      const pickup = await getInspectionByRental(rentalId, "pickup");
      setPickupInspection(pickup);
    }

    setLoading(false);
  };

  const handleFileSelect = async (photoTypeId: string, file: File) => {
    const validation = validateInspectionPhoto(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // Create preview
    const preview = URL.createObjectURL(file);

    setPhotos((prev) => ({
      ...prev,
      [photoTypeId]: {
        ...prev[photoTypeId],
        file,
        preview,
        uploaded: false,
        url: null,
      },
    }));
  };

  const handleToggleDamage = (photoTypeId: string, checked: boolean) => {
    setPhotos((prev) => ({
      ...prev,
      [photoTypeId]: {
        ...prev[photoTypeId],
        hasDamage: checked,
      },
    }));
  };

  const uploadAllPhotos = async (): Promise<Array<{ photoTypeId: string; url: string; hasDamage: boolean }>> => {
    if (!userId || !rentalId) return [];

    const uploadedPhotos: Array<{ photoTypeId: string; url: string; hasDamage: boolean }> = [];

    for (const type of INSPECTION_PHOTO_TYPES) {
      const photoState = photos[type.id];
      if (!photoState.file) continue;

      setPhotos((prev) => ({
        ...prev,
        [type.id]: { ...prev[type.id], uploading: true },
      }));

      const url = await uploadInspectionPhoto(userId, rentalId, type.id, photoState.file);

      if (url) {
        uploadedPhotos.push({
          photoTypeId: type.id,
          url,
          hasDamage: photoState.hasDamage,
        });

        setPhotos((prev) => ({
          ...prev,
          [type.id]: { ...prev[type.id], uploading: false, uploaded: true, url },
        }));
      } else {
        setPhotos((prev) => ({
          ...prev,
          [type.id]: { ...prev[type.id], uploading: false },
        }));
      }
    }

    return uploadedPhotos;
  };

  const handleSubmit = async () => {
    if (!rental || !userId) return;

    // Check if all photos are selected
    const missingPhotos = INSPECTION_PHOTO_TYPES.filter((type) => !photos[type.id].file);
    if (missingPhotos.length > 0) {
      toast.error(
        `Faltam ${missingPhotos.length} foto(s) obrigatória(s): ${missingPhotos.map((p) => p.label).join(", ")}`
      );
      return;
    }

    setSubmitting(true);

    try {
      // Upload all photos
      const uploadedPhotos = await uploadAllPhotos();

      if (uploadedPhotos.length !== INSPECTION_PHOTO_TYPES.length) {
        toast.error("Erro ao fazer upload de algumas fotos. Tente novamente.");
        setSubmitting(false);
        return;
      }

      // Create inspection
      const inspection = await createInspection({
        rentalId: rental.id,
        vehicleId: rental.vehicle_id,
        performedBy: userId,
        kind: inspectionKind,
        photos: uploadedPhotos,
        notes,
      });

      if (inspection) {
        const kindLabel = inspectionKind === "pickup" ? "retirada" : "devolução";
        toast.success(`Vistoria de ${kindLabel} realizada com sucesso!`);

        const vehicleTitle = vehicle?.title || `${vehicle?.brand} ${vehicle?.model}`;

        // Send email notification when pickup inspection is completed by owner
        if (inspectionKind === "pickup" && renter) {
          const ownerName = owner?.full_name || "Proprietário";
          
          notifyPickupInspectionCompleted(
            rental.renter_id,
            ownerName,
            vehicleTitle,
            rental.id
          ).catch((err) => console.error("Erro ao enviar notificação:", err));
        }

        // Send email notification to owner when dropoff inspection is completed
        if (inspectionKind === "dropoff" && owner) {
          const hasDamages = uploadedPhotos.some((p) => p.hasDamage);
          const renterName = renter?.full_name || "Locatário";

          notifyDropoffInspectionCompleted(
            rental.owner_id,
            renterName,
            vehicleTitle,
            rental.id,
            hasDamages
          ).catch((err) => console.error("Erro ao enviar notificação:", err));
        }

        navigate("/reservations");
      } else {
        toast.error("Erro ao salvar vistoria. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro na vistoria:", error);
      toast.error("Erro ao processar vistoria");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!existingInspection || !vehicle || !rental) return;

    setDownloadingPdf(true);
    try {
      const reportData: InspectionReportData = {
        inspection: existingInspection.inspection,
        photos: existingInspection.photos,
        vehicle,
        rental,
        owner,
        renter,
      };

      await generateInspectionPDF(reportData);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadComparisonPdf = async () => {
    if (!existingInspection || !pickupInspection || !vehicle || !rental) return;

    setDownloadingPdf(true);
    try {
      const pickupData: InspectionReportData = {
        inspection: pickupInspection.inspection,
        photos: pickupInspection.photos,
        vehicle,
        rental,
        owner,
        renter,
      };

      const dropoffData: InspectionReportData = {
        inspection: existingInspection.inspection,
        photos: existingInspection.photos,
        vehicle,
        rental,
        owner,
        renter,
      };

      await generateComparisonPDF(pickupData, dropoffData);
      toast.success("Comparativo PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF comparativo:", error);
      toast.error("Erro ao gerar PDF comparativo");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const completedCount = Object.values(photos).filter((p) => p.file).length;
  const totalRequired = INSPECTION_PHOTO_TYPES.length;
  const isComplete = completedCount === totalRequired;

  const kindLabel = inspectionKind === "pickup" ? "Retirada" : "Devolução";
  const kindDescription =
    inspectionKind === "pickup"
      ? "Tire fotos do estado atual do veículo antes da entrega"
      : "Tire fotos do estado do veículo na devolução";

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WebLayout>
    );
  }

  // Show existing inspection with download options
  if (existingInspection) {
    return (
      <WebLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/reservations")}
            className="mb-4 gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>

          <div className="text-center py-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Vistoria de {kindLabel} Concluída</h1>
            <p className="text-muted-foreground mb-6">
              A vistoria de {kindLabel.toLowerCase()} foi realizada em{" "}
              {new Date(existingInspection.inspection.created_at).toLocaleDateString("pt-BR")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-2">
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Baixar Relatório PDF
              </Button>

              {inspectionKind === "dropoff" && pickupInspection && (
                <Button
                  variant="outline"
                  onClick={handleDownloadComparisonPdf}
                  disabled={downloadingPdf}
                  className="gap-2"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Baixar Comparativo
                </Button>
              )}
            </div>
          </div>

          {/* Show photos grid */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Fotos da Vistoria</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {existingInspection.photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.image_url}
                    alt={photo.description || "Foto"}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg">
                    {photo.description}
                    {photo.has_damage && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Avaria
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/reservations")}
            className="mb-4 gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Car className="w-8 h-8" />
                Vistoria de {kindLabel}
              </h1>
              <p className="text-muted-foreground mt-2">{kindDescription}</p>
            </div>
            <Badge variant={isComplete ? "default" : "secondary"} className="text-lg px-4 py-2">
              {completedCount}/{totalRequired}
            </Badge>
          </div>

          {vehicle && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                    <Car className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {vehicle.title || `${vehicle.brand} ${vehicle.model}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.year} • {vehicle.color} • Placa: {vehicle.plate}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Photo Grid */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {INSPECTION_PHOTO_TYPES.map((photoType) => (
            <PhotoUploadCard
              key={photoType.id}
              photoType={photoType}
              state={photos[photoType.id]}
              onFileSelect={(file) => handleFileSelect(photoType.id, file)}
              onToggleDamage={(checked) => handleToggleDamage(photoType.id, checked)}
              disabled={submitting}
            />
          ))}
        </div>

        {/* Notes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Observações Adicionais</CardTitle>
            <CardDescription>
              Descreva qualquer avaria, arranhão ou situação relevante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Ex: Pequeno arranhão na porta traseira direita, desgaste no banco do motorista..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={submitting}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between gap-4 p-4 bg-secondary/30 rounded-xl">
          <div>
            {!isComplete && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">
                  Faltam {totalRequired - completedCount} foto(s) obrigatória(s)
                </span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-2 text-primary">
                <Check className="w-5 h-5" />
                <span className="font-medium">Todas as fotos foram adicionadas</span>
              </div>
            )}
          </div>

          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!isComplete || submitting}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Concluir Vistoria
              </>
            )}
          </Button>
        </div>
      </div>
    </WebLayout>
  );
}

// Photo Upload Card Component
interface PhotoUploadCardProps {
  photoType: InspectionPhotoType;
  state: PhotoState;
  onFileSelect: (file: File) => void;
  onToggleDamage: (checked: boolean) => void;
  disabled?: boolean;
}

function PhotoUploadCard({
  photoType,
  state,
  onFileSelect,
  onToggleDamage,
  disabled,
}: PhotoUploadCardProps) {
  const inputId = `photo-${photoType.id}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <Card className={`overflow-hidden transition-all ${state.file ? "border-primary" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {state.file ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Camera className="w-4 h-4 text-muted-foreground" />
            )}
            {photoType.label}
          </CardTitle>
          {state.uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <CardDescription className="text-xs">{photoType.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.preview ? (
          <div className="relative">
            <img
              src={state.preview}
              alt={photoType.label}
              className="w-full h-40 object-cover rounded-lg"
            />
            <label
              htmlFor={inputId}
              className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-lg cursor-pointer hover:bg-background text-sm font-medium"
            >
              Trocar
            </label>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-secondary/50 transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Clique para adicionar</span>
          </label>
        )}

        <input
          type="file"
          id={inputId}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          disabled={disabled || state.uploading}
          className="hidden"
        />

        {state.file && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`damage-${photoType.id}`}
              checked={state.hasDamage}
              onCheckedChange={(checked) => onToggleDamage(checked as boolean)}
              disabled={disabled}
            />
            <Label
              htmlFor={`damage-${photoType.id}`}
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Há avaria visível nesta foto
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
