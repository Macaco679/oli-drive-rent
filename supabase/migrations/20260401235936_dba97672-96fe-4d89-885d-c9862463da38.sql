
-- Sync existing approved rentals: set driver_license_verification_status based on the renter's profile driver_license_status
UPDATE public.oli_rentals r
SET driver_license_verification_status = 
  CASE 
    WHEN p.driver_license_status = 'approved' THEN 'approved'
    WHEN p.driver_license_status = 'rejected' THEN 'rejected'
    WHEN p.driver_license_status = 'pending' THEN 'pending'
    ELSE 'not_started'
  END,
  driver_license_verified_at = 
    CASE 
      WHEN p.driver_license_status = 'approved' THEN p.driver_license_verified_at
      ELSE NULL
    END,
  driver_license_id = p.driver_license_id
FROM public.oli_profiles p
WHERE p.id = r.renter_id
  AND r.status IN ('approved', 'active')
  AND r.driver_license_verification_status IS NULL;
