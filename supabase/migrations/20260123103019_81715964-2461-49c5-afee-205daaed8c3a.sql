-- The trigger oli_touch_conversation_last_message needs to bypass RLS
-- since it's updating the conversation after a message INSERT
-- We need to grant the trigger function the ability to update

-- Drop and recreate the function to ensure it works correctly
CREATE OR REPLACE FUNCTION public.oli_touch_conversation_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
BEGIN
  -- This runs with elevated privileges, bypassing RLS
  UPDATE public.oli_conversations
  SET last_message_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- Also remove the manual update from chatService since trigger handles it
-- But we still need the code to work - let's just make sure we can update

-- Now let's also verify the chatService code path works
-- The issue might be the INSERT policy - let's double check by testing