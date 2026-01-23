-- Prevent RLS recursion and reliably authorize chat access
-- We use a SECURITY DEFINER helper to check membership in a conversation

CREATE OR REPLACE FUNCTION public.oli_is_conversation_participant(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.oli_conversation_participants p
    where p.conversation_id = _conversation_id
      and p.user_id = auth.uid()
  );
$$;

-- =========================
-- oli_conversation_participants
-- =========================
DROP POLICY IF EXISTS "Participants: members can read" ON public.oli_conversation_participants;

CREATE POLICY "Participants: members can read"
ON public.oli_conversation_participants
FOR SELECT
USING (
  public.oli_is_conversation_participant(conversation_id)
);

-- =========================
-- oli_messages
-- =========================
DROP POLICY IF EXISTS "Messages: participants can read" ON public.oli_messages;
DROP POLICY IF EXISTS "Messages: participants can send" ON public.oli_messages;

CREATE POLICY "Messages: participants can read"
ON public.oli_messages
FOR SELECT
USING (
  public.oli_is_conversation_participant(conversation_id)
);

CREATE POLICY "Messages: participants can send"
ON public.oli_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.oli_is_conversation_participant(conversation_id)
);

-- =========================
-- oli_conversations
-- =========================
-- Replace the conversations read policy to also use the helper (avoids depending on participant-table RLS)
DROP POLICY IF EXISTS "Conversations: participants can read" ON public.oli_conversations;

CREATE POLICY "Conversations: participants can read"
ON public.oli_conversations
FOR SELECT
USING (
  public.oli_is_conversation_participant(id)
);
