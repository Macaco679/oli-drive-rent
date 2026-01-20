// Supabase Client
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://sgpktbljjlixmyjmhppa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncGt0YmxqamxpeG15am1ocHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTE5MjksImV4cCI6MjA4NDQ4NzkyOX0.OoTf_1N0KWWGSfnk-6ZE-M2yg5z8wmej6E83bdWKUAU";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
