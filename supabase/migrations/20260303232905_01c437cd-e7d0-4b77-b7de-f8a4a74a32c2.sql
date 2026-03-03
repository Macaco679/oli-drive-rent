-- Fix RLS for vehicle owner reads (also fixes INSERT ... RETURNING with is_active=false)
-- Current SELECT policy only allows is_active=true, which blocks returning inserted inactive vehicles.

DROP POLICY IF EXISTS "Owners can view their vehicles" ON public.oli_vehicles;

CREATE POLICY "Owners can view their vehicles"
ON public.oli_vehicles
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);