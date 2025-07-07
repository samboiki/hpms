// FINAL SOLUTION - No environment variables at all
import { createClient } from '@supabase/supabase-js';

// Hardcoded values - no environment variables
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create a wrapper to ensure we always have valid values
function getSupabaseClient() {
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: { schema: 'public' },
      auth: { persistSession: true }
    });
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    // Return a fallback client with same credentials
    return createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM',
      {
        db: { schema: 'public' },
        auth: { persistSession: true }
      }
    );
  }
}

// Initialize Supabase with hardcoded values
const supabase = getSupabaseClient();

export { supabase };