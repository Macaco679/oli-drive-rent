-- Fix the RLS policies for oli_messages - the current policies have a bug
-- They compare p.conversation_id = p.conversation_id (self-reference) instead of the message's conversation_id

-- Drop existing policies
DROP POLICY IF EXISTS "Messages: participants can read" ON oli_messages;
DROP POLICY IF EXISTS "Messages: participants can send" ON oli_messages;

-- Create corrected policies that properly reference oli_messages.conversation_id
CREATE POLICY "Messages: participants can read" 
ON oli_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM oli_conversation_participants p
    WHERE p.conversation_id = oli_messages.conversation_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Messages: participants can send" 
ON oli_messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM oli_conversation_participants p
    WHERE p.conversation_id = oli_messages.conversation_id 
    AND p.user_id = auth.uid()
  )
);