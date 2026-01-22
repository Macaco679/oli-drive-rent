import { useState } from "react";
import { Upload, X, Star, Loader2, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  VehiclePhoto,
  validatePhoto,
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  setPhotoCover,
} from "@/lib/vehiclePhotoService";

interface VehiclePhotoGalleryProps {
  vehicleId: string;
  photos: VehiclePhoto[];
  onPhotosChange: (photos: VehiclePhoto[]) => void;
  maxPhotos?: number;
  editable?: boolean;
}

export function VehiclePhotoGallery({
  vehicleId,
  photos,
  onPhotosChange,
  maxPhotos = 10,
  editable = true,
}: VehiclePhotoGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = maxPhotos - photos.length;
    if (availableSlots <= 0) {
      toast.error(`Limite de ${maxPhotos} fotos atingido`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);
    
    // Validate all files first
    for (const file of filesToUpload) {
      const validation = validatePhoto(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        e.target.value = "";
        return;
      }
    }

    setUploading(true);
    const newPhotos: VehiclePhoto[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      // First photo is cover if there are no existing photos
      const isCover = photos.length === 0 && i === 0;
      
      const photo = await uploadVehiclePhoto(vehicleId, file, isCover);
      if (photo) {
        newPhotos.push(photo);
      } else {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (newPhotos.length > 0) {
      onPhotosChange([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} foto(s) enviada(s)`);
    }

    setUploading(false);
    e.target.value = "";
  };

  const handleDelete = async (photo: VehiclePhoto) => {
    setDeletingId(photo.id);
    
    const success = await deleteVehiclePhoto(photo.id, photo.image_url);
    
    if (success) {
      const updatedPhotos = photos.filter((p) => p.id !== photo.id);
      
      // If we deleted the cover and there are other photos, set the first one as cover
      if (photo.is_cover && updatedPhotos.length > 0) {
        await setPhotoCover(vehicleId, updatedPhotos[0].id);
        updatedPhotos[0] = { ...updatedPhotos[0], is_cover: true };
      }
      
      onPhotosChange(updatedPhotos);
      toast.success("Foto removida");
    } else {
      toast.error("Erro ao remover foto");
    }
    
    setDeletingId(null);
  };

  const handleSetCover = async (photo: VehiclePhoto) => {
    if (photo.is_cover) return;
    
    setSettingCoverId(photo.id);
    
    const success = await setPhotoCover(vehicleId, photo.id);
    
    if (success) {
      const updatedPhotos = photos.map((p) => ({
        ...p,
        is_cover: p.id === photo.id,
      }));
      // Re-sort: cover first
      updatedPhotos.sort((a, b) => {
        if (a.is_cover) return -1;
        if (b.is_cover) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      onPhotosChange(updatedPhotos);
      toast.success("Foto de capa atualizada");
    } else {
      toast.error("Erro ao definir foto de capa");
    }
    
    setSettingCoverId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {photos.length} de {maxPhotos} fotos • JPG, PNG ou WebP • Máx. 5MB
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {/* Existing photos */}
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square group rounded-xl overflow-hidden border-2 border-border bg-muted"
          >
            <img
              src={photo.image_url}
              alt="Foto do veículo"
              className="w-full h-full object-cover"
            />
            
            {/* Cover badge */}
            {photo.is_cover && (
              <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground shadow-lg">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Capa
              </Badge>
            )}
            
            {/* Hover overlay with actions */}
            {editable && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!photo.is_cover && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSetCover(photo)}
                    disabled={settingCoverId === photo.id}
                    className="h-8 text-xs"
                  >
                    {settingCoverId === photo.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Star className="w-3 h-3 mr-1" />
                        Capa
                      </>
                    )}
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(photo)}
                  disabled={deletingId === photo.id}
                  className="h-8 text-xs"
                >
                  {deletingId === photo.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </Button>
              </div>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {editable && photos.length < maxPhotos && (
          <label
            className={`aspect-square rounded-xl border-2 border-dashed border-primary/40 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all ${
              uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-xs text-primary mt-2">Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-primary/60" />
                <span className="text-xs text-primary/60 mt-2 font-medium">
                  Adicionar foto
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Empty state */}
      {photos.length === 0 && !editable && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mb-2" />
          <p>Nenhuma foto disponível</p>
        </div>
      )}
    </div>
  );
}
