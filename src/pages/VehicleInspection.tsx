import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Car,
  ChevronLeft,
  Check,
  Loader2,
  ShieldCheck,
  Download,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getVehicleById, getProfileById, OliRental, OliVehicle, OliProfile } from "@/lib/supabase";
import {
  InspectionStep,
  INSPECTION_STEPS_CONFIG,
  INSPECTION_PHOTO_SLOTS,
  InspectionFormData,
  PhotoState,
  DEFAULT_CHECKLIST,
  WebhookResponse,
} from "@/lib/inspectionTypes";
import {
  getInspectionByRental,
  uploadInspectionPhoto,
  createInspection,
  Inspection,
  InspectionPhoto,
} from "@/lib/inspectionService";
import { getContractByRentalId, RentalContract } from "@/lib/contractService";
import { submitInspectionToWebhook } from "@/lib/inspectionWebhookService";
import { InspectionPhotoUploadGrid } from "@/components/inspection/InspectionPhotoUploadGrid";
import { InspectionFormFields } from "@/components/inspection/InspectionForm";
import { InspectionStatusCard } from "@/components/inspection/InspectionStatusCard";
import { InspectionFailedPhotos } from "@/components/inspection/InspectionFailedPhotos";
import { generateInspectionPDF, InspectionReportData } from "@/lib/inspectionPdfService";

export default function VehicleInspection() {
  const { rentalId } = useParams<{ rentalId: string }>();
  const [searchParams] = useSearchParams();
  const stepParam = searchParams.get("step") as InspectionStep | null;
  const kindParam = searchParams.get("kind") as "pickup" | "dropoff" | null;
  const navigate = useNavigate();

  // Derive inspection step
  const inspectionStep: InspectionStep = stepParam || (kindParam === "dropoff" ? "renter_return_inspection" : "owner_initial_inspection");
  const stepConfig = INSPECTION_STEPS_CONFIG[inspectionStep];

  const getInspectionStorageKey = (rentalIdValue: string, stepValue: InspectionStep, performedByUserIdValue: string) =>
    `oli_inspection_id_${rentalIdValue}_${stepValue}_${performedByUserIdValue}`;

  const [loading, setLoading] = useState(true);
  const [rental, setRental] = useState<OliRental | null>(null);
  const [vehicle, setVehicle] = useState<OliVehicle | null>(null);
  const [owner, setOwner] = useState<OliProfile | null>(null);
  const [renter, setRenter] = useState<OliProfile | null>(null);
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [webhookInspectionId, setWebhookInspectionId] = useState<string | null>(null);
  const [existingInspection, setExistingInspection] = useState<{ inspection: Inspection; photos: InspectionPhoto[] } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Form state
  const [formData, setFormData] = useState<InspectionFormData>({
    mileage: "",
    fuel_level: "",
    is_clean: true,
    has_visible_damage: false,
    damage_notes: "",
    notes: "",
    checklist: { ...DEFAULT_CHECKLIST },
  });

  // Photo states
  const [photos, setPhotos] = useState<Record<string, PhotoState>>(() => {
    const initial: Record<string, PhotoState> = {};
    INSPECTION_PHOTO_SLOTS.forEach((slot) => {
      initial[slot.id] = {
        file: null, preview: null, uploading: false, uploaded: false,
        url: null, hasDamage: false, validationStatus: "pending", validationReason: null,
        validationHint: null,
      };
    });
    return initial;
  });
  const [extraPhotos, setExtraPhotos] = useState<Array<{ file: File; preview: string }>>([]);

  // Submit state
  const [submitStatus, setSubmitStatus] = useState<"idle" | "uploading" | "validating" | "success" | "rejected" | "error">("idle");
  const [submitProgress, setSubmitProgress] = useState(0);

  useEffect(() => {
    loadData();
  }, [rentalId, inspectionStep]);

  const loadData = async () => {
    if (!rentalId) { navigate("/reservations"); return; }
    const { user } = await getCurrentUser();
    if (!user) { navigate("/auth"); return; }
    setUserId(user.id);

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

    // Validate role
    const isOwner = rentalData.owner_id === user.id;
    const isRenter = rentalData.renter_id === user.id;

    if (stepConfig.performedByRole === "owner" && !isOwner) {
      toast.error("Apenas o proprietário pode realizar esta vistoria");
      navigate("/reservations");
      return;
    }
    if (stepConfig.performedByRole === "renter" && !isRenter) {
      toast.error("Apenas o locatário pode realizar esta vistoria");
      navigate("/reservations");
      return;
    }

    setRental(rentalData as OliRental);

    const storageKey = getInspectionStorageKey(rentalData.id, inspectionStep, user.id);
    const storedInspectionId = localStorage.getItem(storageKey);
    if (storedInspectionId) {
      setWebhookInspectionId(storedInspectionId);
    }

    const [vehicleData, ownerData, renterData, contractData] = await Promise.all([
      getVehicleById(rentalData.vehicle_id),
      getProfileById(rentalData.owner_id),
      getProfileById(rentalData.renter_id),
      getContractByRentalId(rentalId),
    ]);

    setVehicle(vehicleData);
    setOwner(ownerData);
    setRenter(renterData);
    setContract(contractData);

    // Check for existing inspection of this stage
    const existing = await getInspectionByRental(rentalId, stepConfig.inspectionKind);
    if (existing && existing.inspection.inspection_stage === inspectionStep) {
      setExistingInspection(existing);
      setWebhookInspectionId(existing.inspection.id);
      localStorage.setItem(storageKey, existing.inspection.id);
    }

    setLoading(false);
  };

  // Photo handlers
  const handlePhotoSelect = (slotId: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        file, preview,
        uploaded: false, url: null,
        validationStatus: "pending", validationReason: null, validationHint: null,
      },
    }));
  };

  const handleToggleDamage = (slotId: string, checked: boolean) => {
    setPhotos((prev) => ({ ...prev, [slotId]: { ...prev[slotId], hasDamage: checked } }));
  };

  const handleRemovePhoto = (slotId: string) => {
    setPhotos((prev) => ({
      ...prev,
      [slotId]: {
        file: null, preview: null, uploading: false, uploaded: false,
        url: null, hasDamage: false, validationStatus: "pending", validationReason: null,
        validationHint: null,
      },
    }));
  };

  const handleAddExtraPhoto = (file: File) => {
    const preview = URL.createObjectURL(file);
    setExtraPhotos((prev) => [...prev, { file, preview }]);
  };

  const handleRemoveExtraPhoto = (index: number) => {
    setExtraPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormChange = (partial: Partial<InspectionFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  };

  // Validation
  const completedPhotos = Object.values(photos).filter((p) => p.file).length;
  const totalRequired = INSPECTION_PHOTO_SLOTS.length;
  const allPhotosReady = completedPhotos === totalRequired;
  const hasRejected = Object.values(photos).some((p) => p.validationStatus === "rejected");
  const rejectedCount = Object.values(photos).filter((p) => p.validationStatus === "rejected").length;

  const canSubmit = () => {
    if (!allPhotosReady) return false;
    if (!formData.mileage.trim()) return false;
    if (!formData.fuel_level) return false;
    if (formData.has_visible_damage && !formData.damage_notes.trim()) return false;
    if (submitStatus === "uploading" || submitStatus === "validating") return false;
    return true;
  };

  // Trigger file input for a specific photo slot (for re-upload from failed list)
  const handleReuploadClick = (slotId: string) => {
    // Reset the photo state so the slot shows as empty in the grid
    handleRemovePhoto(slotId);
    // Scroll to the photo grid slot
    const el = document.getElementById(`photo-slot-${slotId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Trigger the file input click after scrolling
      setTimeout(() => {
        const input = el.querySelector('input[type="file"]') as HTMLInputElement;
        if (input) input.click();
      }, 400);
    }
  };

  // Parse n8n webhook response into a normalized format
  const parseWebhookResponse = (raw: WebhookResponse) => {
    let resp = raw as any;
    if (Array.isArray(resp)) resp = resp[0];

    const isApproved = resp.ok === true || resp.status === "approved" || resp.approved === true;

    const photoResults: Array<{
      photo_type: string;
      label?: string;
      status: "approved" | "rejected";
      reason?: string | null;
      hint?: string;
      confidence?: number;
    }> = [];

    if (resp.photos && Array.isArray(resp.photos)) {
      resp.photos.forEach((p: any) => {
        photoResults.push({
          photo_type: p.photo_type, label: p.label, status: p.status,
          reason: p.reason, hint: p.hint, confidence: p.confidence || 0,
        });
      });
    } else if (resp.needs_reupload && Array.isArray(resp.needs_reupload)) {
      resp.needs_reupload.forEach((p: any) => {
        photoResults.push({
          photo_type: p.photo_type, label: p.label, status: "rejected",
          reason: p.reason, hint: p.hint,
        });
      });
    } else if (resp.photo_analysis && Array.isArray(resp.photo_analysis)) {
      resp.photo_analysis.forEach((p: any) => {
        photoResults.push({ photo_type: p.photo_type, status: p.status, reason: p.reason, confidence: p.confidence });
      });
    }

    if (resp.failed_photos && Array.isArray(resp.failed_photos) && photoResults.length === 0) {
      resp.failed_photos.forEach((key: string) => {
        photoResults.push({ photo_type: key, status: "rejected", reason: "Foto precisa ser reenviada" });
      });
    }

    return { ...resp, approved: isApproved, photoResults };
  };

  const applyPhotoValidationResults = (photoResults: Array<{
    photo_type: string; status: "approved" | "rejected"; reason?: string | null; hint?: string;
  }>) => {
    setPhotos((prev) => {
      const updated = { ...prev };
      photoResults.forEach((r) => {
        if (updated[r.photo_type]) {
          if (r.status === "rejected") {
            updated[r.photo_type] = {
              ...updated[r.photo_type],
              file: null, uploaded: false, url: null,
              validationStatus: "rejected",
              validationReason: r.reason || "Foto precisa ser reenviada",
              validationHint: r.hint || null,
            };
          } else {
            updated[r.photo_type] = {
              ...updated[r.photo_type],
              validationStatus: "approved",
              validationReason: null,
              validationHint: null,
            };
          }
        }
      });
      return updated;
    });
  };

  // Submit
  const handleSubmit = async () => {
    if (!rental || !userId || !vehicle) return;
    if (!canSubmit()) {
      if (!allPhotosReady) toast.error(`Faltam ${totalRequired - completedPhotos} foto(s) obrigatória(s)`);
      else if (!formData.mileage.trim()) toast.error("Informe a quilometragem atual");
      else if (!formData.fuel_level) toast.error("Selecione o nível de combustível");
      else if (formData.has_visible_damage && !formData.damage_notes.trim()) toast.error("Descreva as avarias visíveis");
      return;
    }

    const storageKey = getInspectionStorageKey(rental.id, inspectionStep, userId);
    let inspectionIdForWebhook = webhookInspectionId || localStorage.getItem(storageKey);

    setSubmitStatus("uploading");
    setSubmitProgress(10);

    try {
      if (!inspectionIdForWebhook) {
        const { data: draftInspection, error: draftError } = await supabase
          .from("oli_inspections")
          .insert({
            rental_id: rental.id,
            vehicle_id: rental.vehicle_id,
            performed_by: userId,
            inspection_kind: stepConfig.inspectionKind,
            inspection_stage: inspectionStep,
            actor_role: stepConfig.performedByRole,
            side: "front",
            notes: formData.notes || null,
            status: "pending_validation",
            required_photos_count: totalRequired,
          })
          .select("id")
          .single();

        if (draftError || !draftInspection) {
          toast.error("Não foi possível criar a vistoria no Supabase.");
          setSubmitStatus("error");
          setSubmitProgress(0);
          return;
        }

        inspectionIdForWebhook = draftInspection.id;
        setWebhookInspectionId(draftInspection.id);
        localStorage.setItem(storageKey, draftInspection.id);
      } else {
        setWebhookInspectionId(inspectionIdForWebhook);
        localStorage.setItem(storageKey, inspectionIdForWebhook);
      }

      // Upload photos to storage first
      const uploadedUrls: Record<string, string> = {};
      const slots = INSPECTION_PHOTO_SLOTS;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const state = photos[slot.id];
        if (!state.file) continue;
        setPhotos((prev) => ({ ...prev, [slot.id]: { ...prev[slot.id], uploading: true } }));
        const url = await uploadInspectionPhoto(userId, rental.id, slot.id, state.file);
        if (url) {
          uploadedUrls[slot.id] = url;
          setPhotos((prev) => ({ ...prev, [slot.id]: { ...prev[slot.id], uploading: false, uploaded: true, url } }));
        } else {
          setPhotos((prev) => ({ ...prev, [slot.id]: { ...prev[slot.id], uploading: false } }));
          toast.error(`Erro ao enviar foto: ${slot.label}`);
          setSubmitStatus("error");
          setSubmitProgress(0);
          return;
        }
        setSubmitProgress(10 + Math.round((i / slots.length) * 30));
      }

      setSubmitProgress(45);
      setSubmitStatus("validating");

      // Send to webhook with real files
      let webhookResponse: WebhookResponse;
      try {
        webhookResponse = await submitInspectionToWebhook({
          inspectionId: inspectionIdForWebhook,
          rentalId: rental.id,
          contractId: contract?.id,
          contractNumber: contract?.contract_number || undefined,
          vehicleId: rental.vehicle_id,
          ownerId: rental.owner_id,
          renterId: rental.renter_id,
          inspectionStep,
          performedByRole: stepConfig.performedByRole,
          performedByUserId: userId,
          vehiclePlate: vehicle.plate || undefined,
          vehicleModel: vehicle.model || undefined,
          vehicleBrand: vehicle.brand || undefined,
          vehicleYear: vehicle.year || undefined,
          vehicleColor: vehicle.color || undefined,
          formData,
          photos,
          extraPhotos,
        });
      } catch {
        // Webhook failed - keep inspection as pending_validation
        await createInspection({
          inspectionId: inspectionIdForWebhook,
          rentalId: rental.id,
          vehicleId: rental.vehicle_id,
          performedBy: userId,
          kind: stepConfig.inspectionKind,
          inspectionStage: inspectionStep,
          actorRole: stepConfig.performedByRole,
          photos: Object.entries(uploadedUrls).map(([id, url], idx) => ({
            photoTypeId: id,
            url,
            hasDamage: photos[id].hasDamage,
            sortOrder: idx,
          })),
          notes: formData.notes,
          status: "pending_validation",
        });
        toast.warning("Não foi possível enviar para validação. Salvando como pendente.");
        setSubmitStatus("error");
        setSubmitProgress(0);
        return;
      }

      setSubmitProgress(80);

      // Handle webhook response - parse the n8n format
      const parsed = parseWebhookResponse(webhookResponse);

      if (!parsed.approved) {
        // Apply photo validation results to state
        if (parsed.photoResults.length > 0) {
          applyPhotoValidationResults(parsed.photoResults);
        }

        await createInspection({
          inspectionId: inspectionIdForWebhook,
          rentalId: rental.id,
          vehicleId: rental.vehicle_id,
          performedBy: userId,
          kind: stepConfig.inspectionKind,
          inspectionStage: inspectionStep,
          actorRole: stepConfig.performedByRole,
          photos: Object.entries(uploadedUrls).map(([id, url], idx) => ({
            photoTypeId: id,
            url,
            hasDamage: photos[id].hasDamage,
            sortOrder: idx,
          })),
          notes: formData.notes,
          status: "rejected",
          validatedByAi: true,
          validationSummary: parsed.message || parsed.title || "Fotos rejeitadas pela IA",
          photoValidations: parsed.photoResults,
        });

        // Save full webhook payload
        await supabase
          .from("oli_inspections")
          .update({ webhook_payload: parsed as any })
          .eq("id", inspectionIdForWebhook);

        setSubmitStatus("rejected");
        setSubmitProgress(0);
        toast.error(parsed.message || parsed.title || "Algumas fotos foram rejeitadas pela IA.");
        return;
      }

      // Success - update existing inspection
      setSubmitProgress(90);
      const inspection = await createInspection({
        inspectionId: inspectionIdForWebhook,
        rentalId: rental.id,
        vehicleId: rental.vehicle_id,
        performedBy: userId,
        kind: stepConfig.inspectionKind,
        inspectionStage: inspectionStep,
        actorRole: stepConfig.performedByRole,
        photos: Object.entries(uploadedUrls).map(([id, url], idx) => ({
          photoTypeId: id, url, hasDamage: photos[id].hasDamage, sortOrder: idx,
        })),
        notes: formData.notes,
        status: "validated",
        validatedByAi: true,
        validationSummary: parsed.message || "Aprovada pela IA",
        photoValidations: parsed.photoResults,
      });

      // Save webhook payload
      await supabase
        .from("oli_inspections")
        .update({ webhook_payload: parsed as any })
        .eq("id", inspectionIdForWebhook);

      setSubmitProgress(100);
      setSubmitStatus("success");

      if (inspection) {
        toast.success(`${stepConfig.title} validada e concluída!`);
        setTimeout(() => navigate("/reservations"), 1500);
      }
    } catch (error) {
      console.error("Erro na vistoria:", error);
      toast.error("Erro ao processar vistoria");
      setSubmitStatus("error");
      setSubmitProgress(0);
    }
  };

  const handleDownloadPdf = async () => {
    if (!existingInspection || !vehicle || !rental) return;
    setDownloadingPdf(true);
    try {
      await generateInspectionPDF({
        inspection: existingInspection.inspection,
        photos: existingInspection.photos,
        vehicle, rental, owner, renter,
      });
      toast.success("PDF gerado!");
    } catch {
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </WebLayout>
    );
  }

  // Show existing inspection
  if (existingInspection) {
    const insp = existingInspection.inspection;
    return (
      <WebLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate("/reservations")} className="mb-4 gap-2">
            <ChevronLeft className="w-4 h-4" />Voltar
          </Button>

          <div className="text-center py-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{stepConfig.title} - Concluída</h1>
            <p className="text-muted-foreground mb-2">
              Realizada em {new Date(insp.created_at).toLocaleDateString("pt-BR")}
            </p>
            {insp.validated_by_ai && (
              <Badge variant="default" className="gap-1">
                <ShieldCheck className="w-3 h-3" />Validada por IA
              </Badge>
            )}

            <div className="flex gap-3 justify-center mt-6">
              <Button onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-2">
                {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Baixar Relatório
              </Button>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">
              Fotos ({existingInspection.photos.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {existingInspection.photos.map((photo) => (
                <div key={photo.id} className="relative rounded-lg overflow-hidden">
                  <img src={photo.image_url} alt={photo.description || "Foto"} className="w-full h-32 object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 flex justify-between">
                    <span>{photo.description}</span>
                    {photo.has_damage && <Badge variant="destructive" className="text-[10px]">Avaria</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WebLayout>
    );
  }

  // Form view
  return (
    <WebLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <Button variant="ghost" onClick={() => navigate("/reservations")} className="mb-4 gap-2">
          <ChevronLeft className="w-4 h-4" />Voltar
        </Button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Car className="w-7 h-7" />
              {stepConfig.title}
            </h1>
            <p className="text-muted-foreground mt-1">{stepConfig.description}</p>
            <p className="text-xs text-muted-foreground mt-1">As fotos serão validadas por IA</p>
          </div>
          <Badge variant={allPhotosReady ? "default" : "secondary"} className="text-lg px-4 py-2">
            {completedPhotos}/{totalRequired}
          </Badge>
        </div>

        {/* Vehicle info */}
        {vehicle && (
          <Card className="mb-6">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                <Car className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">{vehicle.title || `${vehicle.brand} ${vehicle.model}`}</p>
                <p className="text-sm text-muted-foreground">
                  {vehicle.year} • {vehicle.color} • Placa: {vehicle.plate}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status card */}
        <InspectionStatusCard
          status={submitStatus}
          progress={submitProgress}
          failedCount={rejectedCount}
        />

        {/* Failed photos summary */}
        <InspectionFailedPhotos photos={photos} onReuploadClick={handleReuploadClick} />

        {/* Form fields */}
        <div className="mb-8">
          <InspectionFormFields
            formData={formData}
            onChange={handleFormChange}
            disabled={submitStatus === "uploading" || submitStatus === "validating"}
          />
        </div>

        {/* Photo grid */}
        <div className="mb-8">
          <InspectionPhotoUploadGrid
            photos={photos}
            onPhotoSelect={handlePhotoSelect}
            onToggleDamage={handleToggleDamage}
            onRemovePhoto={handleRemovePhoto}
            extraPhotos={extraPhotos}
            onAddExtraPhoto={handleAddExtraPhoto}
            onRemoveExtraPhoto={handleRemoveExtraPhoto}
            disabled={submitStatus === "uploading" || submitStatus === "validating"}
          />
        </div>

        {/* Submit bar */}
        <div className="flex items-center justify-between gap-4 p-4 bg-secondary/30 rounded-xl sticky bottom-4">
          <div>
            {!allPhotosReady && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium text-sm">
                  Faltam {totalRequired - completedPhotos} foto(s)
                </span>
              </div>
            )}
            {allPhotosReady && !formData.mileage.trim() && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Informe a quilometragem</span>
              </div>
            )}
            {allPhotosReady && formData.mileage.trim() && !formData.fuel_level && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Selecione o combustível</span>
              </div>
            )}
            {canSubmit() && !hasRejected && (
              <div className="flex items-center gap-2 text-primary">
                <Check className="w-5 h-5" />
                <span className="font-medium text-sm">Pronto para enviar</span>
              </div>
            )}
            {hasRejected && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Corrija as fotos rejeitadas</span>
              </div>
            )}
          </div>

          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className="gap-2"
          >
            {submitStatus === "uploading" || submitStatus === "validating" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {submitStatus === "validating" ? "Validando..." : "Enviando..."}
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Validar e Concluir
              </>
            )}
          </Button>
        </div>
      </div>
    </WebLayout>
  );
}
