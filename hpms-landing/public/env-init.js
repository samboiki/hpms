// Initialize environment variables before any app code runs
// This prevents "Missing Supabase environment variables" errors from any bundled code

(function() {
  'use strict';
  
  // Create process.env if it doesn't exist
  if (typeof window !== 'undefined') {
    window.process = window.process || { env: {} };
    window.process.env = window.process.env || {};
    
    // Set Supabase environment variables
    window.process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
    window.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
    
    // Also set for Vite compatibility (in case any bundled code expects it)
    window.import = window.import || {};
    window.import.meta = window.import.meta || { env: {} };
    window.import.meta.env = window.import.meta.env || {};
    window.import.meta.env.VITE_SUPABASE_URL = window.process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.import.meta.env.VITE_SUPABASE_ANON_KEY = window.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
})();