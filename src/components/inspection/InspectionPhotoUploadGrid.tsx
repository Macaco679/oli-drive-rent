import { Camera, Check, XCircle, AlertCircle, Loader2, Image as ImageIcon, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { INSPECTION_PHOTO_SLOTS, InspectionPhotoSlot, PhotoState } from "@/lib/inspectionTypes";
import { validateInspectionPhoto } from "@/lib/inspectionService";
import { toast } from "sonner";

interface InspectionPhotoUploadGridProps {
  photos: Record<string, PhotoState>;
  onPhotoSelect: (slotId: string, file: File) => void;
  onToggleDamage: (slotId: string, checked: boolean) => void;
  onRemovePhoto: (slotId: string) => void;
  extraPhotos: Array<{ file: File; preview: string }>;
  onAddExtraPhoto: (file: File) => void;
  onRemoveExtraPhoto: (index: number) => void;
  disabled?: boolean;
}

export function InspectionPhotoUploadGrid({
  photos,
  onPhotoSelect,
  onToggleDamage,
  onRemovePhoto,
  extraPhotos,
  onAddExtraPhoto,
  onRemoveExtraPhoto,
  disabled,
}: InspectionPhotoUploadGridProps) {
  const handleFileValidation = (file: File, slotId: string) => {
    const validation = validateInspectionPhoto(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    onPhotoSelect(slotId, file);
  };

  const handleExtraFileValidation = (file: File) => {
    const validation = validateInspectionPhoto(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    onAddExtraPhoto(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Fotos Obrigatórias</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Tire as 8 fotos obrigatórias abaixo. Cada foto deve ser clara e mostrar o item especificado.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INSPECTION_PHOTO_SLOTS.map((slot, idx) => (
            <PhotoSlotCard
              key={slot.id}
              slot={slot}
              state={photos[slot.id]}
              index={idx + 1}
              onFileSelect={(file) => handleFileValidation(file, slot.id)}
              onToggleDamage={(checked) => onToggleDamage(slot.id, checked)}
              onRemove={() => onRemovePhoto(slot.id)}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* Extra photos */}
      <div>
        <h3 className="text-base font-semibold mb-1">Fotos Extras (opcional)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Adicione fotos adicionais de detalhes, avarias ou qualquer observação visual.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {extraPhotos.map((ep, idx) => (
            <div key={idx} className="relative rounded-lg overflow-hidden border border-border">
              <img src={ep.preview} alt={`Extra ${idx + 1}`} className="w-full h-32 object-cover" />
              {!disabled && (
                <button
                  onClick={() => onRemoveExtraPhoto(idx)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-secondary/50 transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Adicionar extra</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExtraFileValidation(file);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual photo slot card
interface PhotoSlotCardProps {
  slot: InspectionPhotoSlot;
  state: PhotoState;
  index: number;
  onFileSelect: (file: File) => void;
  onToggleDamage: (checked: boolean) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function PhotoSlotCard({ slot, state, index, onFileSelect, onToggleDamage, onRemove, disabled }: PhotoSlotCardProps) {
  const inputId = `photo-input-${slot.id}`;
  const isRejected = state.validationStatus === "rejected";
  const isApproved = state.validationStatus === "approved";

  return (
    <Card
      id={`photo-slot-${slot.id}`}
      className={`overflow-hidden transition-all ${
        isRejected ? "border-destructive" : isApproved ? "border-primary" : state.file ? "border-primary/50" : ""
      }`}
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-secondary text-xs flex items-center justify-center font-bold">
              {index}
            </span>
            {isApproved ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : isRejected ? (
              <XCircle className="w-3.5 h-3.5 text-destructive" />
            ) : state.file ? (
              <Check className="w-3.5 h-3.5 text-primary/60" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{slot.label}</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {state.uploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            {isRejected && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Rejeitada</Badge>}
            {isApproved && <Badge variant="default" className="text-[10px] px-1.5 py-0">OK</Badge>}
          </div>
        </div>
        <CardDescription className="text-[11px]">{slot.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
        {state.preview ? (
          <div className="relative">
            <img
              src={state.preview}
              alt={slot.label}
              className={`w-full h-28 object-cover rounded-lg ${isRejected ? "ring-2 ring-destructive" : ""}`}
            />
            {!disabled && (
              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                <label
                  htmlFor={inputId}
                  className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded cursor-pointer hover:bg-background text-xs font-medium"
                >
                  {isRejected ? "Reenviar" : "Trocar"}
                </label>
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-secondary/50 transition-colors"
          >
            <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">Tirar foto</span>
          </label>
        )}

        {isRejected && state.validationReason && (
          <div className="bg-destructive/10 rounded p-1.5 text-[11px] text-destructive flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{state.validationReason}</span>
          </div>
        )}
        {isRejected && state.validationHint && (
          <div className="bg-amber-500/10 rounded p-1.5 text-[11px] text-amber-700 flex items-start gap-1">
            <span className="flex-shrink-0">💡</span>
            <span className="italic">{state.validationHint}</span>
          </div>
        )}

        <input
          type="file"
          id={inputId}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.target.value = "";
          }}
          disabled={disabled || state.uploading}
          className="hidden"
        />

        {state.file && (
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`damage-${slot.id}`}
              checked={state.hasDamage}
              onCheckedChange={(checked) => onToggleDamage(checked as boolean)}
              disabled={disabled}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor={`damage-${slot.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Avaria visível
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
