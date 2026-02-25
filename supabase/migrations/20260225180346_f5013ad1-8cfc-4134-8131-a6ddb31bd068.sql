
-- Allow rental participants (owner/renter) to view each other's profiles
CREATE POLICY "Rental participants can view each other profiles"
ON public.oli_profiles
FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM oli_rentals r
    WHERE (r.owner_id = auth.uid() AND r.renter_id = oli_profiles.id)
       OR (r.renter_id = auth.uid() AND r.owner_id = oli_profiles.id)
  )
);
