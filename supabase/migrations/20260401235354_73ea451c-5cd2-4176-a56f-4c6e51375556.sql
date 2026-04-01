ALTER TABLE public.oli_rentals
  ADD COLUMN IF NOT EXISTS driver_license_verification_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_license_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_license_verification_payload jsonb DEFAULT NULL;