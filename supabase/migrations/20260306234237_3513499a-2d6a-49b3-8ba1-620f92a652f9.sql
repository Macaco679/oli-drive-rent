CREATE POLICY "owners_can_view_rental_payments"
ON public.oli_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.oli_rentals r
    WHERE r.id = oli_payments.rental_id
    AND r.owner_id = auth.uid()
  )
);