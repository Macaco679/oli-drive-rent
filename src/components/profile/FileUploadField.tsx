import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Check } from "lucide-react";

interface FileUploadFieldProps {
  label: string;
  required?: boolean;
  file: File | null;
  preview: string | null;
  onFileSelect: (file: File | null, preview: string | null) => void;
  error?: string;
}

export function FileUploadField({
  label,
  required = false,
  file,
  preview,
  onFileSelect,
  error,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/heic", "image/heif"];
    if (!validTypes.includes(selectedFile.type)) {
      alert("Formato inválido. Use JPG, PNG ou HEIC.");
      return;
    }

    // Validate file size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(selectedFile);
    onFileSelect(selectedFile, previewUrl);
  };

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    onFileSelect(null, null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        onChange={handleFileChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-primary bg-secondary/50">
          <img
            src={preview}
            alt={label}
            className="w-full h-40 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-green-100 hover:bg-green-200"
            >
              <Check className="w-4 h-4 text-green-600" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-white/90 hover:bg-white"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 truncate">
            {file?.name}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors hover:border-primary hover:bg-secondary/50 ${
            error ? "border-destructive" : "border-border"
          }`}
        >
          <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">
            Clique para enviar
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG ou HEIC (máx 5MB)
          </span>
        </button>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
