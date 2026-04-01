import { useState } from "react";
import { Check, Clock, Lock, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullTimelineStep, TimelineStepStatus } from "@/lib/inspectionTypes";
import { PaymentStatus } from "@/hooks/usePaymentRealtime";
import { RentalContract } from "@/lib/contractService";
import { deriveContractStage } from "@/components/contracts/ContractTimeline";
import { InspectionRecord } from "@/hooks/useInspectionRealtime";

const statusIcons: Record<TimelineStepStatus, React.ElementType> = {
  done: Check,
  current: Clock,
  pending: Lock,
  analyzing: Loader2,
  rejected: AlertCircle,
};

const statusColors: Record<TimelineStepStatus, string> = {
  done: "text-primary border-primary bg-primary/10",
  current: "text-amber-600 dark:text-amber-400 border-amber-500 bg-amber-500/10",
  pending: "text-muted-foreground/50 border-muted bg-muted/50",
  analyzing: "text-blue-600 border-blue-500 bg-blue-500/10",
  rejected: "text-destructive border-destructive bg-destructive/10",
};

const lineColors: Record<TimelineStepStatus, string> = {
  done: "bg-primary",
  current: "bg-amber-500/40",
  pending: "bg-border",
  analyzing: "bg-blue-500/40",
  rejected: "bg-destructive/40",
};

function getInspectionStepStatus(
  stage: string,
  inspections: InspectionRecord[]
): TimelineStepStatus {
  const inspection = inspections.find((i) => i.inspection_stage === stage);
  if (!inspection) return "pending";
  if (inspection.status === "validated" || inspection.status === "completed") return "done";
  if (inspection.status === "pending_validation") return "analyzing";
  if (inspection.status === "rejected") return "rejected";
  if (inspection.status === "draft") return "current";
  return "pending";
}


function mapRentalLicenseToTimeline(
  renterLicenseStatus: string | null | undefined,
  rentalStatus: string
): TimelineStepStatus {
  if (rentalStatus === "pending_approval") return "pending";
  if (renterLicenseStatus === "approved") return "done";
  if (renterLicenseStatus === "pending") return "analyzing";
  if (renterLicenseStatus === "rejected") return "rejected";
  return rentalStatus === "approved" || rentalStatus === "active" ? "current" : "pending";
}
function mapPaymentToTimeline(
  paymentStatus: PaymentStatus,
  ownerInitialDone: boolean
): TimelineStepStatus {
  if (!paymentStatus) return ownerInitialDone ? "current" : "pending";
  switch (paymentStatus) {
    case "paid":
    case "confirmed":
    case "received":
    case "receveid":
      return "done";
    case "pending":
      return "current";
    case "failed":
    case "refunded":
      return "rejected";
    default:
      return "pending";
  }
}

export function buildFullTimeline(
  contract: RentalContract | null,
  inspections: InspectionRecord[],
  rentalStatus: string,
  hasPaid: boolean,
  paymentStatus?: PaymentStatus,
  renterLicenseStatus?: string | null
): FullTimelineStep[] {
  const cStage = deriveContractStage(contract);

  const contractCreated = cStage !== "no_contract" && cStage !== "preparing";
  const renterSigned = ["renter_signed", "both_signed", "inspection_released"].includes(cStage);
  const ownerSigned = ["owner_signed", "both_signed", "inspection_released"].includes(cStage);
  const bothSigned = ["both_signed", "inspection_released"].includes(cStage);

  const ownerInitial = getInspectionStepStatus("owner_initial_inspection", inspections);
  const ownerInitialDone = ownerInitial === "done";
  const renterPickup = getInspectionStepStatus("renter_pickup_inspection", inspections);
  const renterPickupDone = renterPickup === "done";
  const ownerFinal = getInspectionStepStatus("owner_final_inspection", inspections);

  const paymentDone = hasPaid;
  const paymentStepStatus = mapPaymentToTimeline(paymentStatus ?? null, ownerInitialDone);
  const renterLicenseStepStatus = mapRentalLicenseToTimeline(renterLicenseStatus, rentalStatus);

  return [
    { key: "approved", label: "Pedido aprovado", status: rentalStatus !== "pending_approval" ? "done" : "current" },
    { key: "renter_cnh", label: "CNH locatario", status: renterLicenseStepStatus },
    { key: "contract_sent", label: "Contrato enviado", status: contractCreated ? "done" : renterLicenseStepStatus === "done" ? "current" : "pending" },
    { key: "renter_signed", label: "Contrato locatÃ¡rio", status: renterSigned ? "done" : contractCreated ? "current" : "pending" },
    { key: "owner_signed", label: "Contrato locador", status: ownerSigned ? "done" : renterSigned ? "current" : "pending" },
    { key: "contract_done", label: "Contrato assinado", status: bothSigned ? "done" : "pending" },
    { key: "owner_initial", label: "Vistoria locador", status: bothSigned ? ownerInitial : "pending" },
    { key: "payment", label: "Pagamento", status: bothSigned ? paymentStepStatus : "pending" },
    { key: "renter_pickup", label: "Vistoria locatÃ¡rio retirada", status: paymentDone ? (renterPickup === "pending" ? "current" : renterPickup) : "pending" },
    { key: "owner_final", label: "Vistoria locador final", status: renterPickupDone ? (ownerFinal === "pending" ? "current" : ownerFinal) : "pending" },
  ];
}

interface InspectionTimelineProps {
  contract: RentalContract | null;
  inspections: InspectionRecord[];
  rentalStatus: string;
  hasPaid?: boolean;
  paymentStatus?: PaymentStatus;
  renterLicenseStatus?: string | null;
  className?: string;
  initialVisible?: number;
}

export function InspectionTimeline({ contract, inspections, rentalStatus, hasPaid = false, paymentStatus, renterLicenseStatus, className, initialVisible = 10 }: InspectionTimelineProps) {
  const allSteps = buildFullTimeline(contract, inspections, rentalStatus, hasPaid, paymentStatus, renterLicenseStatus);
  const [expanded, setExpanded] = useState(false);
  const visibleSteps = initialVisible >= allSteps.length || expanded ? allSteps : allSteps.slice(0, initialVisible);
  const hasMore = initialVisible < allSteps.length && !expanded;

  return (
    <div className={cn("space-y-0", className)}>
      {visibleSteps.map((step, i) => {
        const Icon = statusIcons[step.status];
        const isLast = i === visibleSteps.length - 1 && !hasMore;

        return (
          <div key={step.key} className="flex gap-2">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0",
                  statusColors[step.status]
                )}
              >
                <Icon className={cn("w-2.5 h-2.5", step.status === "analyzing" && "animate-spin")} />
              </div>
              {!isLast && (
                <div className={cn("w-0.5 flex-1 min-h-[12px]", lineColors[step.status])} />
              )}
            </div>

            <div
              className={cn(
                "pb-1.5 text-xs font-medium leading-5",
                step.status === "pending" ? "text-muted-foreground/50" : "text-foreground"
              )}
            >
              {step.label}
              {step.status === "done" && <span className="text-[10px] text-primary ml-1">âœ“</span>}
              {step.status === "rejected" && <span className="text-[10px] text-destructive ml-1">âœ—</span>}
              {step.status === "analyzing" && <span className="text-[10px] text-blue-600 ml-1">analisando...</span>}
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="text-xs text-primary font-medium hover:underline ml-7 pt-1"
        >
          Ver mais etapas
        </button>
      )}
      {expanded && initialVisible < allSteps.length && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="text-xs text-primary font-medium hover:underline ml-7 pt-1"
        >
          Ver menos
        </button>
      )}
    </div>
  );
}

