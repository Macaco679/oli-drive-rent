CREATE POLICY "Renters can update driver license verification on their rentals"
ON public.oli_rentals
FOR UPDATE
TO authenticated
USING (auth.uid() = renter_id)
WITH CHECK (auth.uid() = renter_id);