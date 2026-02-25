
-- Allow rental participants to view each other's addresses
CREATE POLICY "Rental participants can view each other addresses"
ON public.oli_user_addresses
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM oli_rentals r
    WHERE (r.owner_id = auth.uid() AND r.renter_id = oli_user_addresses.user_id)
       OR (r.renter_id = auth.uid() AND r.owner_id = oli_user_addresses.user_id)
  )
);
