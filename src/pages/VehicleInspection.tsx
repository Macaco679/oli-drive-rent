import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Camera, 
  Upload, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronLeft,
  Car,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getVehicleById, OliRental, OliVehicle } from "@/lib/supabase";
import {
  INSPECTION_PHOTO_TYPES,
  InspectionPhotoType,
  validateInspectionPhoto,
  uploadInspectionPhoto,
  createInspection,
  getInspectionByRental,
} from "@/lib/inspectionService";

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
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rental, setRental] = useState<OliRental | null>(null);
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [existingInspection, setExistingInspection] = useState(false);

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
  }, [rentalId]);

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

    // Check if user is the owner
    if (rentalData.owner_id !== user.id) {
      toast.error("Apenas o proprietário pode realizar a vistoria");
      navigate("/reservations");
      return;
    }

    // Check rental status - must be active (after payment)
    if (rentalData.status !== "active") {
      toast.error("A vistoria só pode ser realizada após o pagamento");
      navigate("/reservations");
      return;
    }

    setRental(rentalData as OliRental);

    // Fetch vehicle
    const vehicleData = await getVehicleById(rentalData.vehicle_id);
    setVehicle(vehicleData);

    // Check for existing inspection
    const existing = await getInspectionByRental(rentalId, "pickup");
    if (existing && existing.photos.length >= INSPECTION_PHOTO_TYPES.length) {
      setExistingInspection(true);
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
        kind: "pickup",
        photos: uploadedPhotos,
        notes,
      });

      if (inspection) {
        toast.success("Vistoria realizada com sucesso!");
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

  const completedCount = Object.values(photos).filter((p) => p.file).length;
  const totalRequired = INSPECTION_PHOTO_TYPES.length;
  const isComplete = completedCount === totalRequired;

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WebLayout>
    );
  }

  if (existingInspection) {
    return (
      <WebLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Vistoria já realizada</h1>
            <p className="text-muted-foreground mb-6">
              A vistoria de retirada deste veículo já foi concluída.
            </p>
            <Button onClick={() => navigate("/reservations")}>
              Voltar para Reservas
            </Button>
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
                Vistoria Veicular
              </h1>
              <p className="text-muted-foreground mt-2">
                Tire fotos do estado atual do veículo antes da entrega
              </p>
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
