import { Check, Clock, Lock, FileText, PenTool, UserCheck, ClipboardCheck } from "lucide-react";
import { RentalContract } from "@/lib/contractService";
import { cn } from "@/lib/utils";

export type ContractStage =
  | "preparing"
  | "sent"
  | "awaiting_renter"
  | "awaiting_owner"
  | "renter_signed"
  | "owner_signed"
  | "both_signed"
  | "inspection_released";

export function deriveContractStage(contract: RentalContract | null): ContractStage {
  if (!contract || (!contract.clicksign_envelope_id && contract.status === "pending")) {
    return "preparing";
  }
  const renterSigned = !!contract.renter_signed_at;
  const ownerSigned = !!contract.owner_signed_at;

  if (renterSigned && ownerSigned) {
    return contract.inspection_released_at ? "inspection_released" : "both_signed";
  }
  if (renterSigned && !ownerSigned) return "renter_signed";
  if (ownerSigned && !renterSigned) return "owner_signed";

  // Has envelope but nobody signed yet
  return "sent";
}

export function getContractStageLabel(stage: ContractStage): string {
  switch (stage) {
    case "preparing": return "Contrato sendo preparado";
    case "sent": return "Contrato enviado para assinatura";
    case "awaiting_renter": return "Aguardando assinatura do locatário";
    case "awaiting_owner": return "Aguardando assinatura do proprietário";
    case "renter_signed": return "Locatário assinou. Aguardando assinatura do proprietário";
    case "owner_signed": return "Proprietário assinou. Aguardando assinatura do locatário";
    case "both_signed": return "Contrato assinado por ambas as partes";
    case "inspection_released": return "Vistoria liberada";
  }
}

interface TimelineStep {
  label: string;
  status: "done" | "current" | "locked";
  icon: React.ElementType;
}

function getTimelineSteps(contract: RentalContract | null): TimelineStep[] {
  const stage = deriveContractStage(contract);

  const contractCreated = stage !== "preparing";
  const renterSigned = !!contract?.renter_signed_at;
  const ownerSigned = !!contract?.owner_signed_at;
  const bothSigned = renterSigned && ownerSigned;
  const inspectionReleased = !!contract?.inspection_released_at;

  return [
    {
      label: "Contrato criado",
      icon: FileText,
      status: contractCreated ? "done" : "current",
    },
    {
      label: "Assinatura do locatário",
      icon: PenTool,
      status: renterSigned
        ? "done"
        : contractCreated
          ? "current"
          : "locked",
    },
    {
      label: "Assinatura do proprietário",
      icon: UserCheck,
      status: ownerSigned
        ? "done"
        : renterSigned
          ? "current"
          : "locked",
    },
    {
      label: "Vistoria",
      icon: ClipboardCheck,
      status: inspectionReleased
        ? "done"
        : bothSigned
          ? "current"
          : "locked",
    },
  ];
}

const statusIcons = {
  done: Check,
  current: Clock,
  locked: Lock,
} as const;

const statusColors = {
  done: "text-primary border-primary bg-primary/10",
  current: "text-amber-600 dark:text-amber-400 border-amber-500 bg-amber-500/10",
  locked: "text-muted-foreground/50 border-muted bg-muted/50",
} as const;

const lineColors = {
  done: "bg-primary",
  current: "bg-amber-500/40",
  locked: "bg-border",
} as const;

interface ContractTimelineProps {
  contract: RentalContract | null;
  className?: string;
}

export function ContractTimeline({ contract, className }: ContractTimelineProps) {
  const steps = getTimelineSteps(contract);

  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, i) => {
        const StatusIcon = statusIcons[step.status];
        const isLast = i === steps.length - 1;

        return (
          <div key={step.label} className="flex gap-3">
            {/* Indicator column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  statusColors[step.status]
                )}
              >
                <StatusIcon className="w-4 h-4" />
              </div>
              {!isLast && (
                <div
                  className={cn("w-0.5 flex-1 min-h-[24px]", lineColors[step.status])}
                />
              )}
            </div>

            {/* Label */}
            <div className={cn(
              "pt-1 pb-4 text-sm font-medium",
              step.status === "locked" ? "text-muted-foreground/50" : "text-foreground"
            )}>
              {step.label}
              {step.status === "done" && (
                <span className="text-xs text-primary ml-2">✓</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
