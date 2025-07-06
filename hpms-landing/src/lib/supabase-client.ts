import { createClient } from '@supabase/supabase-js';

// Create a singleton instance with guaranteed values
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    // Always use these hardcoded values
    const url = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
    
    console.log('Creating Supabase client with hardcoded values');
    
    supabaseInstance = createClient(url, anonKey, {
      db: {
        schema: 'public'
      },
      auth: {
        persistSession: true
      }
    });
  }
  
  return supabaseInstance;
}

// Export a default client for backward compatibility
export const supabase = getSupabaseClient();