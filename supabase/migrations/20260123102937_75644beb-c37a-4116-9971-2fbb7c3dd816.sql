-- Add UPDATE policy for oli_conversations
-- Participants can update the last_message_at field
CREATE POLICY "Conversations: participants can update"
ON public.oli_conversations
FOR UPDATE
USING (
  public.oli_is_conversation_participant(id)
)
WITH CHECK (
  public.oli_is_conversation_participant(id)
);

-- Also ensure we have proper RLS checks - add debug logging
-- First let's verify the function works by making it more robust
CREATE OR REPLACE FUNCTION public.oli_is_conversation_participant(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _result boolean;
BEGIN
  -- Get the current user
  _user_id := auth.uid();
  
  -- If no user, return false
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check participation
  SELECT EXISTS (
    SELECT 1
    FROM public.oli_conversation_participants p
    WHERE p.conversation_id = _conversation_id
      AND p.user_id = _user_id
  ) INTO _result;
  
  RETURN _result;
END;
$$;