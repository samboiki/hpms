import { createClient } from '@supabase/supabase-js';

// Hardcoded values - these are public anon keys
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

function createSupabaseClient() {
  // Double-check we have values
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase configuration missing - this should never happen!');
    console.error('URL:', SUPABASE_URL);
    console.error('Key exists:', !!SUPABASE_ANON_KEY);
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: true
    }
  });
}

// Initialize immediately
export const supabase = createSupabaseClient();