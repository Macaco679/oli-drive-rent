-- Allow conversation participants to view each other's basic profile
-- This enables showing the owner's name in chat instead of "Usuário"

CREATE OR REPLACE FUNCTION public.oli_shares_conversation_with(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.oli_conversation_participants p1
    JOIN public.oli_conversation_participants p2 
      ON p1.conversation_id = p2.conversation_id
    WHERE p1.user_id = auth.uid()
      AND p2.user_id = profile_id
  );
$$;

-- Add policy for conversation participants to view each other's profiles
CREATE POLICY "Conversation participants can view each other"
ON public.oli_profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR public.oli_shares_conversation_with(id)
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.oli_profiles;