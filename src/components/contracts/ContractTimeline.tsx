import { Check, Clock, Lock, FileText, PenTool, UserCheck, ClipboardCheck, Download } from "lucide-react";
import { RentalContract } from "@/lib/contractService";
import { cn } from "@/lib/utils";

export type ContractStage =
  | "no_contract"
  | "preparing"
  | "sent"
  | "awaiting_renter"
  | "awaiting_owner"
  | "renter_signed"
  | "owner_signed"
  | "both_signed"
  | "inspection_released";

/**
 * Derives the contract stage using clicksign_status as the primary source of truth,
 * falling back to timestamp-based detection.
 */
export function deriveContractStage(contract: RentalContract | null): ContractStage {
  if (!contract) return "no_contract";

  // Use clicksign_status as primary source when available
  const cs = contract.clicksign_status;

  if (cs === "signed_completed" || contract.status === "signed") {
    if (contract.inspection_released_at) return "inspection_released";
    return "both_signed";
  }

  if (cs === "awaiting_owner_signature") {
    return "renter_signed";
  }

  if (cs === "awaiting_renter_signature") {
    return "owner_signed";
  }

  // Fallback: use timestamps if clicksign_status not yet populated
  const renterSigned = !!contract.renter_signed_at;
  const ownerSigned = !!contract.owner_signed_at;

  if (renterSigned && ownerSigned) {
    return contract.inspection_released_at ? "inspection_released" : "both_signed";
  }
  if (renterSigned && !ownerSigned) return "renter_signed";
  if (ownerSigned && !renterSigned) return "owner_signed";

  // Has envelope → sent for signing
  if (contract.clicksign_envelope_id) return "sent";

  // No envelope, status pending → still preparing
  if (contract.status === "pending") return "preparing";

  return "preparing";
}

export function getContractStageLabel(stage: ContractStage): string {
  switch (stage) {
    case "no_contract": return "Contrato ainda não enviado";
    case "preparing": return "Contrato sendo preparado";
    case "sent": return "Contrato enviado para assinatura";
    case "awaiting_renter": return "Aguardando assinatura do locatário";
    case "awaiting_owner": return "Aguardando assinatura do locador";
    case "renter_signed": return "Locatário assinou. Aguardando assinatura do locador";
    case "owner_signed": return "Locador assinou. Aguardando assinatura do locatário";
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

  const contractCreated = stage !== "no_contract" && stage !== "preparing";
  const renterSigned = stage === "renter_signed" || stage === "both_signed" || stage === "inspection_released";
  const ownerSigned = stage === "owner_signed" || stage === "both_signed" || stage === "inspection_released";
  const bothSigned = stage === "both_signed" || stage === "inspection_released";
  const inspectionReleased = stage === "inspection_released";

  return [
    {
      label: "Contrato enviado",
      icon: FileText,
      status: contractCreated ? "done" : stage === "preparing" ? "current" : "locked",
    },
    {
      label: "Locatário assinou",
      icon: PenTool,
      status: renterSigned
        ? "done"
        : contractCreated && !ownerSigned
          ? "current"
          : contractCreated
            ? "locked"
            : "locked",
    },
    {
      label: "Locador assinou",
      icon: UserCheck,
      status: ownerSigned
        ? "done"
        : renterSigned
          ? "current"
          : "locked",
    },
    {
      label: "Contrato finalizado",
      icon: ClipboardCheck,
      status: bothSigned
        ? "done"
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
  const stage = deriveContractStage(contract);

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

      {/* Show file link when contract is fully signed */}
      {contract?.file_url && (stage === "both_signed" || stage === "inspection_released") && (
        <div className="flex items-center gap-2 pt-2 pl-11">
          <a
            href={contract.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Arquivo final do contrato disponível
          </a>
        </div>
      )}
    </div>
  );
}
