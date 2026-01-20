import { useNavigate } from "react-router-dom";
import { ChevronRight, FileCheck, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { LicenseStatus } from "@/contexts/DriverLicenseContext";

interface DriverLicenseCardProps {
  status: LicenseStatus;
}

export function DriverLicenseCard({ status }: DriverLicenseCardProps) {
  const navigate = useNavigate();

  const getStatusConfig = (status: LicenseStatus) => {
    switch (status) {
      case "not_sent":
        return {
          subtitle: "Obrigatório para alugar veículos",
          badge: null,
          buttonText: "Enviar CNH",
          icon: FileCheck,
          iconColor: "text-muted-foreground",
        };
      case "pending":
        return {
          subtitle: "Em análise",
          badge: { label: "Pendente", variant: "warning" as const },
          buttonText: "Ver detalhes",
          icon: Clock,
          iconColor: "text-yellow-600",
        };
      case "approved":
        return {
          subtitle: "Aprovada",
          badge: { label: "Aprovada", variant: "success" as const },
          buttonText: "Ver CNH",
          icon: ShieldCheck,
          iconColor: "text-green-600",
        };
      case "rejected":
        return {
          subtitle: "Rejeitada — reenviar",
          badge: { label: "Rejeitada", variant: "destructive" as const },
          buttonText: "Reenviar CNH",
          icon: AlertTriangle,
          iconColor: "text-red-600",
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const handleClick = () => {
    navigate("/profile/driver-license");
  };

  return (
    <div 
      className="bg-card border-2 border-primary/20 rounded-2xl overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
      onClick={handleClick}
    >
      <div className="p-6 flex items-center gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-lg">Carteira de habilitação</p>
            {config.badge && (
              <span 
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  config.badge.variant === "warning" 
                    ? "bg-amber-100 text-amber-800" 
                    : config.badge.variant === "success"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {config.badge.label}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">{config.subtitle}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}
