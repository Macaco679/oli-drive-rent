// ============================================================
// INSPECTION TYPES & CONSTANTS
// ============================================================

export type InspectionStep =
  | "owner_initial_inspection"
  | "renter_pickup_inspection"
  | "renter_return_inspection"
  | "owner_final_inspection";

export type InspectionStatus = "draft" | "pending_validation" | "validated" | "rejected" | "completed";
export type PhotoValidationStatus = "pending" | "approved" | "rejected";

export interface InspectionPhotoSlot {
  id: string;
  label: string;
  description: string;
}

/** The 8 mandatory photo slots */
export const INSPECTION_PHOTO_SLOTS: InspectionPhotoSlot[] = [
  { id: "front_view", label: "Frontal completa", description: "Vista frontal completa do veículo" },
  { id: "rear_view", label: "Traseira completa", description: "Vista traseira completa do veículo" },
  { id: "left_side", label: "Lateral esquerda", description: "Vista lateral esquerda completa" },
  { id: "right_side", label: "Lateral direita", description: "Vista lateral direita completa" },
  { id: "dashboard_on", label: "Painel ligado", description: "Painel do veículo ligado e visível" },
  { id: "odometer", label: "Hodômetro", description: "Quilometragem / hodômetro visível" },
  { id: "front_interior", label: "Interior dianteiro", description: "Volante, bancos dianteiros e interior" },
  { id: "damage_focus_or_wheels", label: "Avaria / Rodas", description: "Foto de avaria principal ou roda/pneu em destaque" },
  { id: "step_view", label: "Estribo / Step", description: "Foto do estribo (step) do veículo" },
];

export const INSPECTION_STEPS_CONFIG: Record<InspectionStep, {
  title: string;
  description: string;
  performedByRole: "owner" | "renter";
  inspectionKind: "pickup" | "dropoff";
  nextStep: InspectionStep | "payment" | "completed";
}> = {
  owner_initial_inspection: {
    title: "Vistoria Inicial do Locador",
    description: "Locador deve registrar o estado inicial do veículo antes da retirada.",
    performedByRole: "owner",
    inspectionKind: "pickup",
    nextStep: "payment",
  },
  renter_pickup_inspection: {
    title: "Vistoria de Retirada do Locatário",
    description: "Locatário deve confirmar o estado do veículo no momento da retirada.",
    performedByRole: "renter",
    inspectionKind: "pickup",
    nextStep: "renter_return_inspection",
  },
  renter_return_inspection: {
    title: "Vistoria de Devolução do Locatário",
    description: "Locatário deve registrar o estado do veículo na devolução.",
    performedByRole: "renter",
    inspectionKind: "dropoff",
    nextStep: "owner_final_inspection",
  },
  owner_final_inspection: {
    title: "Vistoria Final do Locador",
    description: "Locador deve validar o estado final do veículo após a devolução.",
    performedByRole: "owner",
    inspectionKind: "dropoff",
    nextStep: "completed",
  },
};

export interface InspectionChecklist {
  tires_ok: boolean;
  headlights_ok: boolean;
  taillights_ok: boolean;
  mirrors_ok: boolean;
  windows_ok: boolean;
  body_ok: boolean;
  interior_ok: boolean;
  dashboard_ok: boolean;
  documents_ok: boolean;
  keys_ok: boolean;
}

export const DEFAULT_CHECKLIST: InspectionChecklist = {
  tires_ok: false,
  headlights_ok: false,
  taillights_ok: false,
  mirrors_ok: false,
  windows_ok: false,
  body_ok: false,
  interior_ok: false,
  dashboard_ok: false,
  documents_ok: false,
  keys_ok: false,
};

export const CHECKLIST_LABELS: Record<keyof InspectionChecklist, string> = {
  tires_ok: "Pneus OK",
  headlights_ok: "Faróis OK",
  taillights_ok: "Lanternas OK",
  mirrors_ok: "Retrovisores OK",
  windows_ok: "Vidros OK",
  body_ok: "Lataria OK",
  interior_ok: "Interior OK",
  dashboard_ok: "Painel OK",
  documents_ok: "Documentação entregue/confere",
  keys_ok: "Chave entregue/confere",
};

export interface InspectionFormData {
  mileage: string;
  fuel_level: string;
  is_clean: boolean;
  has_visible_damage: boolean;
  damage_notes: string;
  notes: string;
  checklist: InspectionChecklist;
}

export interface PhotoState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: boolean;
  url: string | null;
  hasDamage: boolean;
  validationStatus: PhotoValidationStatus;
  validationReason: string | null;
  validationHint?: string | null;
}

export interface WebhookPhotoResult {
  photo_type: string;
  label?: string;
  status: "approved" | "rejected";
  reason?: string | null;
  hint?: string;
  confidence?: number;
  detected_photo_type?: string | null;
  odometer_reading?: string | null;
  detected_plate?: string | null;
  dashboard_lit?: boolean | null;
  labels?: string[];
  damage_detected?: boolean;
}

export interface WebhookResponse {
  ok: boolean;
  screen?: string;
  status?: string;
  title?: string;
  message?: string;
  inspection_id?: string;
  rental_id?: string;
  vehicle_id?: string;
  inspection_kind?: string;
  inspection_step?: string;
  actor_role?: string;
  ai_status?: string;
  approved?: boolean;
  summary?: {
    total_required?: number;
    total_approved?: number;
    total_rejected?: number;
    total_missing?: number;
    can_continue?: boolean;
  };
  needs_reupload?: WebhookPhotoResult[];
  needs_reupload_by_type?: Record<string, WebhookPhotoResult>;
  photos?: WebhookPhotoResult[];
  /** Legacy fields */
  failed_photos?: string[];
  photo_analysis?: WebhookPhotoResult[];
  next_step?: string;
  reservation_status?: string;
  contract_status?: string;
}

/** Timeline step statuses */
export type TimelineStepStatus = "done" | "current" | "pending" | "analyzing" | "rejected";

export interface FullTimelineStep {
  key: string;
  label: string;
  status: TimelineStepStatus;
}

export const FUEL_LEVELS = [
  { value: "empty", label: "Reserva" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "three_quarter", label: "3/4" },
  { value: "full", label: "Cheio" },
];
