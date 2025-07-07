// Bulletproof Supabase client initialization
// This file ensures we NEVER have environment variable errors

import { createClient } from '@supabase/supabase-js';

// Constants - these are public values safe to hardcode
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create client with no dependencies on environment variables
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'public' },
  auth: { 
    persistSession: true,
    storageKey: 'newcharm-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});

// Export URL for any components that need it
export const supabaseUrl = SUPABASE_URL;
export const supabaseAnonKey = SUPABASE_ANON_KEY;