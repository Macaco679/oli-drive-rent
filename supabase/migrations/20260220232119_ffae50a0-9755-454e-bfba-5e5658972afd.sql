
-- Add address columns to oli_vehicles for pickup location details
ALTER TABLE public.oli_vehicles
  ADD COLUMN IF NOT EXISTS pickup_street text,
  ADD COLUMN IF NOT EXISTS pickup_neighborhood text,
  ADD COLUMN IF NOT EXISTS pickup_number text,
  ADD COLUMN IF NOT EXISTS pickup_complement text,
  ADD COLUMN IF NOT EXISTS pickup_zip_code text;
