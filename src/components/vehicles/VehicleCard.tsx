import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VehicleCardProps {
  id: string;
  title?: string;
  brand?: string;
  model?: string;
  year?: number;
  coverImage?: string;
  dailyPrice?: number;
  weeklyPrice?: number;
  locationCity?: string;
  locationState?: string;
  status: string;
  isActive: boolean;
}

export const VehicleCard = ({
  id,
  title,
  brand,
  model,
  year,
  coverImage,
  dailyPrice,
  weeklyPrice,
  locationCity,
  locationState,
  status,
  isActive,
}: VehicleCardProps) => {
  const navigate = useNavigate();
  
  const vehicleTitle = title || `${brand || ""} ${model || ""} ${year || ""}`.trim() || "Veículo sem nome";
  const location = locationCity && locationState ? `${locationCity} - ${locationState}` : "Localização não informada";

  return (
    <div
      onClick={() => navigate(`/vehicle/${id}`)}
      className="card-elevated overflow-hidden cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <div className="relative h-48 bg-muted">
        {coverImage ? (
          <img src={coverImage} alt={vehicleTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Sem foto
          </div>
        )}
        <Badge
          className="absolute top-3 right-3"
          variant={status === "available" && isActive ? "default" : "secondary"}
        >
          {status === "available" && isActive ? "Disponível" : "Indisponível"}
        </Badge>
      </div>
      
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-lg text-foreground">{vehicleTitle}</h3>
        
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>
        
        <div className="flex items-center justify-between pt-2">
          {weeklyPrice && (
            <div className="text-sm">
              <span className="text-muted-foreground">Semanal:</span>
              <span className="font-semibold text-primary ml-1">
                R$ {weeklyPrice.toLocaleString('pt-BR')}
              </span>
            </div>
          )}
          {dailyPrice && (
            <div className="text-sm">
              <span className="text-muted-foreground">Diária:</span>
              <span className="font-semibold text-primary ml-1">
                R$ {dailyPrice.toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>
        
        <button className="w-full btn-pill bg-primary text-primary-foreground hover:bg-primary/90 text-sm mt-2">
          Ver detalhes
        </button>
      </div>
    </div>
  );
};
