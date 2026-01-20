// Supabase Client
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://dpjqfhsxojajgsttucph.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwanFmaHN4b2phamdzdHR1Y3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2NTgyMzYsImV4cCI6MjA2MDIzNDIzNn0.PgIIOK7NSnby0jSOX_hfKJ6gvMQnJT1MxAhBWnsmtwA";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
