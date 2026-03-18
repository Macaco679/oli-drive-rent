ALTER TABLE public.oli_profiles
  ADD COLUMN IF NOT EXISTS face_validation_status text NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS face_validation_score numeric NULL,
  ADD COLUMN IF NOT EXISTS face_validation_provider text NULL,
  ADD COLUMN IF NOT EXISTS face_validation_requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS face_validation_validated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS face_validation_reference_id text NULL,
  ADD COLUMN IF NOT EXISTS face_validation_payload jsonb NULL;

UPDATE public.oli_profiles
SET face_validation_status = COALESCE(face_validation_status, CASE WHEN face_recognition_url IS NOT NULL THEN 'pending' ELSE 'not_sent' END)
WHERE face_validation_status IS NULL;

COMMENT ON COLUMN public.oli_profiles.face_validation_status IS 'Workflow status for facial identity validation (not_sent, pending, approved, rejected, needs_review, error)';
COMMENT ON COLUMN public.oli_profiles.face_validation_score IS 'Provider score or confidence for facial validation';
COMMENT ON COLUMN public.oli_profiles.face_validation_provider IS 'Provider/orchestrator identifier (e.g. n8n, DataValid)';
COMMENT ON COLUMN public.oli_profiles.face_validation_requested_at IS 'When facial validation was requested';
COMMENT ON COLUMN public.oli_profiles.face_validation_validated_at IS 'When facial validation received final status';
COMMENT ON COLUMN public.oli_profiles.face_validation_reference_id IS 'External protocol/reference id returned by facial validation provider';
COMMENT ON COLUMN public.oli_profiles.face_validation_payload IS 'Last raw payload/metadata related to facial validation';
