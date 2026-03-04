import { XCircle, AlertCircle, Camera, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INSPECTION_PHOTO_SLOTS, PhotoState } from "@/lib/inspectionTypes";

interface InspectionFailedPhotosProps {
  photos: Record<string, PhotoState>;
  onReuploadClick?: (slotId: string) => void;
}

export function InspectionFailedPhotos({ photos, onReuploadClick }: InspectionFailedPhotosProps) {
  const failedSlots = INSPECTION_PHOTO_SLOTS.filter(
    (slot) => photos[slot.id]?.validationStatus === "rejected"
  );

  if (failedSlots.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5 mb-6">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
          <XCircle className="w-4 h-4" />
          Fotos Rejeitadas ({failedSlots.length}) — Substitua e reenvie
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {failedSlots.map((slot) => {
          const state = photos[slot.id];
          return (
            <div key={slot.id} className="p-3 bg-background rounded-lg border border-destructive/20 space-y-2">
              <div className="flex items-start gap-3">
                {state.preview && (
                  <img src={state.preview} alt={slot.label} className="w-14 h-14 object-cover rounded ring-2 ring-destructive flex-shrink-0 opacity-60" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{slot.label}</p>
                  {state.validationReason && (
                    <p className="text-xs text-destructive flex items-start gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {state.validationReason}
                    </p>
                  )}
                  {state.validationHint && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                      <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
                      <span className="italic">{state.validationHint}</span>
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-shrink-0 gap-1 text-xs"
                  onClick={() => onReuploadClick?.(slot.id)}
                >
                  <Camera className="w-3 h-3" />
                  Refazer
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
