
-- ============================================================
-- INSPECTION: Add new columns for AI validation and 10-photo workflow
-- ============================================================

-- oli_inspections: add status tracking and AI validation columns
ALTER TABLE public.oli_inspections 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS inspection_stage text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS required_photos_count integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS validated_by_ai boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validation_summary text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS owner_approved_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS renter_approved_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone DEFAULT NULL;

-- oli_inspection_photos: add photo_type, validation fields, and metadata
ALTER TABLE public.oli_inspection_photos
ADD COLUMN IF NOT EXISTS photo_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS validation_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validation_confidence numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_labels jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_damage_detected boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS uploaded_by uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inspection_photos_photo_type ON public.oli_inspection_photos (inspection_id, photo_type);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.oli_inspections (status);

-- oli_payments: add provider/Asaas fields for future payment integration
ALTER TABLE public.oli_payments
ADD COLUMN IF NOT EXISTS provider text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS provider_customer_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS provider_payment_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS invoice_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bank_slip_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pix_qr_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pix_copy_paste text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS due_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_detail text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_link text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS webhook_payload jsonb DEFAULT NULL;
