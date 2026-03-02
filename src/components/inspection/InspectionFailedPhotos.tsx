import { XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INSPECTION_PHOTO_SLOTS, PhotoState } from "@/lib/inspectionTypes";

interface InspectionFailedPhotosProps {
  photos: Record<string, PhotoState>;
}

export function InspectionFailedPhotos({ photos }: InspectionFailedPhotosProps) {
  const failedSlots = INSPECTION_PHOTO_SLOTS.filter(
    (slot) => photos[slot.id]?.validationStatus === "rejected"
  );

  if (failedSlots.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5 mb-6">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
          <XCircle className="w-4 h-4" />
          Fotos Rejeitadas ({failedSlots.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {failedSlots.map((slot) => {
          const state = photos[slot.id];
          return (
            <div key={slot.id} className="flex items-start gap-2 p-2 bg-background rounded-lg border border-destructive/20">
              {state.preview && (
                <img src={state.preview} alt={slot.label} className="w-12 h-12 object-cover rounded ring-2 ring-destructive flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{slot.label}</p>
                {state.validationReason && (
                  <p className="text-xs text-destructive flex items-start gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {state.validationReason}
                  </p>
                )}
              </div>
              <Badge variant="destructive" className="text-[10px] flex-shrink-0">Refazer</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
