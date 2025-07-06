import { createClient } from '@supabase/supabase-js';

// Production-safe Supabase client
// This bypasses ALL environment variable checks
const PROD_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';

// Create client directly without any checks
export const supabase = createClient(PROD_URL, PROD_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: true }
});

// Also export for debugging
export const SUPABASE_CONFIG = {
  url: PROD_URL,
  key: PROD_KEY
};