import { Check, Clock, AlertCircle, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface InspectionStatusCardProps {
  status: "idle" | "uploading" | "validating" | "success" | "rejected" | "error";
  progress?: number;
  message?: string;
  failedCount?: number;
}

export function InspectionStatusCard({ status, progress = 0, message, failedCount }: InspectionStatusCardProps) {
  if (status === "idle") return null;

  const config = {
    uploading: {
      icon: Loader2,
      iconClass: "animate-spin text-primary",
      borderClass: "border-primary/30",
      label: "Enviando fotos...",
      description: "Fazendo upload das fotos para o servidor.",
    },
    validating: {
      icon: Loader2,
      iconClass: "animate-spin text-blue-600",
      borderClass: "border-blue-500/30",
      label: "Validando fotos com IA...",
      description: "A IA está analisando cada foto para garantir qualidade e conformidade. Isso pode levar até 1 minuto.",
    },
    success: {
      icon: ShieldCheck,
      iconClass: "text-primary",
      borderClass: "border-primary/30",
      label: "Vistoria validada!",
      description: "Todas as fotos foram aprovadas pela IA.",
    },
    rejected: {
      icon: XCircle,
      iconClass: "text-destructive",
      borderClass: "border-destructive/30 bg-destructive/5",
      label: `${failedCount || 0} foto(s) rejeitada(s) pela IA`,
      description: "Substitua as fotos marcadas em vermelho e tente novamente.",
    },
    error: {
      icon: AlertCircle,
      iconClass: "text-amber-600",
      borderClass: "border-amber-500/30 bg-amber-500/5",
      label: "Erro na validação",
      description: message || "Não foi possível validar. A vistoria foi salva como rascunho.",
    },
  }[status];

  const Icon = config.icon;

  return (
    <Card className={`mb-6 ${config.borderClass}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
          <span className="font-medium text-sm">{config.label}</span>
        </div>
        {(status === "uploading" || status === "validating") && (
          <Progress value={progress} className="h-2.5" />
        )}
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardContent>
    </Card>
  );
}
