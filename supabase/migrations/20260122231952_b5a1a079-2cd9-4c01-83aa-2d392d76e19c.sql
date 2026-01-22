-- ============================================================
-- 1) Fix RLS policies for oli_rental_contracts (allow INSERT/UPDATE)
-- ============================================================

-- Allow owners to create contracts for their rentals
CREATE POLICY "Owners can create contracts for their rentals"
ON public.oli_rental_contracts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.oli_rentals r
    WHERE r.id = oli_rental_contracts.rental_id
      AND r.owner_id = auth.uid()
  )
);

-- Allow owners to update contracts for their rentals
CREATE POLICY "Owners can update contracts for their rentals"
ON public.oli_rental_contracts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.oli_rentals r
    WHERE r.id = oli_rental_contracts.rental_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.oli_rentals r
    WHERE r.id = oli_rental_contracts.rental_id
      AND r.owner_id = auth.uid()
  )
);

-- Allow renters to update contracts (for signing)
CREATE POLICY "Renters can update contracts for signing"
ON public.oli_rental_contracts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.oli_rentals r
    WHERE r.id = oli_rental_contracts.rental_id
      AND r.renter_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.oli_rentals r
    WHERE r.id = oli_rental_contracts.rental_id
      AND r.renter_id = auth.uid()
  )
);

-- ============================================================
-- 2) Create storage bucket for inspection photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for inspection-photos bucket
CREATE POLICY "Anyone can view inspection photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inspection-photos');

CREATE POLICY "Owners can upload inspection photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners can delete their inspection photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inspection-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);