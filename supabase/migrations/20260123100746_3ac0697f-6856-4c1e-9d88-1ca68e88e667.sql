-- Fix the RLS policies for oli_conversation_participants - same bug as oli_messages
-- They compare p2.conversation_id = p2.conversation_id (self-reference) instead of the table's conversation_id

-- Drop existing policy
DROP POLICY IF EXISTS "Participants: members can read" ON oli_conversation_participants;

-- Create corrected policy
CREATE POLICY "Participants: members can read" 
ON oli_conversation_participants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM oli_conversation_participants p2
    WHERE p2.conversation_id = oli_conversation_participants.conversation_id 
    AND p2.user_id = auth.uid()
  )
);